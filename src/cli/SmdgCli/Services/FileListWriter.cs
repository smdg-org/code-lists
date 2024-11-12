namespace SmdgCli.Services;

using System.Text.Json;
using System.Text.Json.Serialization;
using Schemas.Liners;

public class FileListWriter : IFileListWriter
{
    public async Task WriteAsync<T>(
        IEnumerable<T> records,
        string outputDirectory,
        Func<T, string> fileNameSelector,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(records);
        ArgumentNullException.ThrowIfNull(fileNameSelector);

        if (string.IsNullOrWhiteSpace(outputDirectory))
        {
            throw new ArgumentException("Value cannot be null or whitespace.", nameof(outputDirectory));
        }
        
        var jsonSerializerOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };

        var recordFiles = records
            .Select(record => (FileName: fileNameSelector(record), Record: record))
            .ToList();

        await Task.WhenAll(recordFiles.Select(t =>
        {
            var filePath = Path.Combine(outputDirectory, t.FileName);
            var json = JsonSerializer.Serialize(t.Record, jsonSerializerOptions);
            return File.WriteAllTextAsync(filePath, json, cancellationToken);
        }));

        var indexFilePath = Path.Combine(outputDirectory, "_index.json");
        var indexContent = new LinerCodeIndex(recordFiles.Select(t => t.FileName));
        var indexJson = JsonSerializer.Serialize(indexContent, jsonSerializerOptions);
        await File.WriteAllTextAsync(indexFilePath, indexJson, cancellationToken);
        
        var combinedFilePath = Path.Combine(outputDirectory, "_combined.json");
        var combinedJson = JsonSerializer.Serialize(records, jsonSerializerOptions);
        await File.WriteAllTextAsync(combinedFilePath, combinedJson, cancellationToken);

    }
}