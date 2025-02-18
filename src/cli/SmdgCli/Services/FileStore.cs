namespace SmdgCli.Services;

using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Schemas.Liners;

public class FileStore : IFileStore
{
    public const string IndexFileName = "_index.json";
    public const string CombinedFileName = "_combined.json";

    public static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };
    
    public async Task<T?> TryReadAsync<T>(
        string code,
        string outputDirectory,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputDirectory);
        var filePath = Path.Combine(outputDirectory, CodeFileName(code));

        try
        {
            var json = await File.ReadAllTextAsync(filePath, cancellationToken);
            return JsonSerializer.Deserialize<T>(json, JsonOptions);
        }
        catch (Exception)
        {
            return default;
        }
    }

    public async Task<IEnumerable<T>> ReadAllAsync<T>(
        string outputDirectory,
        bool readFromCombined = true,
        CancellationToken cancellationToken = default)
    {
        if (readFromCombined)
        {
            var combinedFilePath = Path.Combine(outputDirectory, CombinedFileName);
            var combinedJson = await File.ReadAllTextAsync(combinedFilePath, cancellationToken);
            return JsonSerializer.Deserialize<IEnumerable<T>>(combinedJson, JsonOptions) ?? [];
        }

        var indexFilePath = Path.Combine(outputDirectory, IndexFileName);
        var indexJson = await File.ReadAllTextAsync(indexFilePath, cancellationToken);
        var indexContent = JsonSerializer.Deserialize<LinerCodeIndex>(indexJson, JsonOptions);
        if (indexContent is null)
        {
            throw new InvalidOperationException("Index file is missing or invalid.");
        }

        var tasks = indexContent.LinerCodeFiles
            .Select(f => File.ReadAllTextAsync(Path.Combine(outputDirectory, f), cancellationToken))
            .ToList();

        await Task.WhenAll(tasks);
        
        var linerCodes = tasks
            .Select(t => t.Result)
            .Select(json => JsonSerializer.Deserialize<T>(json, JsonOptions))
            .ToList();

        if (linerCodes.Any(l => l is null))
        {
            throw new InvalidOperationException("One or more liner code files are missing or invalid.");
        }

        return linerCodes.Select(l => l!);
    }

    public async Task UpsertSingleAsync<T>(
        string code,
        T record,
        string outputDirectory,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputDirectory);
        
        var linerCodeFileName = CodeFileName(code);

        var filePath = Path.Combine(outputDirectory, linerCodeFileName);
        var json = JsonSerializer.Serialize(record, JsonOptions);
        await File.WriteAllTextAsync(filePath, json, cancellationToken);
        
        var indexFilePath = Path.Combine(outputDirectory, IndexFileName);
        var indexJson = await File.ReadAllTextAsync(indexFilePath, cancellationToken);
        var indexContent = JsonSerializer.Deserialize<LinerCodeIndex>(indexJson, JsonOptions);

        // TODO: Update the combined file

        if (indexContent != null && indexContent.LinerCodeFiles.All(f => f != linerCodeFileName))
        {
            var newIndex = indexContent.LinerCodeFiles.ToList();
            newIndex.Add(linerCodeFileName);
            indexContent = new LinerCodeIndex(newIndex.OrderBy(x => x));
            await UpdateIndex(outputDirectory, indexContent, cancellationToken);
        }
    }

    public async Task WriteAllAsync<T>(
        IEnumerable<T> records,
        string outputDirectory,
        Func<T, string> codeSelector,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(records);
        ArgumentNullException.ThrowIfNull(codeSelector);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputDirectory);

        var recordFiles = records
            .Select(record => (FileName: CodeFileName(codeSelector(record)), Record: record))
            .ToList();

        await Task.WhenAll(recordFiles.Select(t =>
        {
            var filePath = Path.Combine(outputDirectory, t.FileName);
            var json = JsonSerializer.Serialize(t.Record, JsonOptions);
            return File.WriteAllTextAsync(filePath, json, cancellationToken);
        }));
        
        var indexContent = new LinerCodeIndex(recordFiles.Select(t => t.FileName).OrderBy(x => x));
        await UpdateIndex(outputDirectory, indexContent, cancellationToken);

        await UpdateCombined(outputDirectory, records, cancellationToken);
    }

    public async Task RebuildCombined<T>(string outputDirectory, CancellationToken cancellationToken)
    {
        var records = await ReadAllAsync<T>(outputDirectory, false, cancellationToken);
        await UpdateCombined(outputDirectory, records, cancellationToken);
    }
    
    private async Task UpdateCombined<T>(string outputDirectory, IEnumerable<T> records, CancellationToken cancellationToken)
    {
        var combinedFilePath = Path.Combine(outputDirectory, CombinedFileName);
        var combinedJson = JsonSerializer.Serialize(records, JsonOptions);
        await File.WriteAllTextAsync(combinedFilePath, combinedJson, cancellationToken);
    }

    private async Task UpdateIndex(string outputDirectory, LinerCodeIndex indexContent, CancellationToken cancellationToken)
    {
        var indexFilePath = Path.Combine(outputDirectory, IndexFileName);
        var indexJson = JsonSerializer.Serialize(indexContent, JsonOptions);
        await File.WriteAllTextAsync(indexFilePath, indexJson, cancellationToken);
    }
    
    private static string CodeFileName(string code) => $"{code.ToLower()}.json";
}