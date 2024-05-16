namespace SmdgCli.Services;

using System.Text.Json;
using System.Text.Json.Serialization;

public class FileListWriter : IFileListWriter
{
    public Task WriteAsync<T>(
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

        return Task.WhenAll(records.Select(record =>
        {
            var fileName = fileNameSelector(record);
            var filePath = Path.Combine(outputDirectory, fileName);
            var json = JsonSerializer.Serialize(record, jsonSerializerOptions);
            return File.WriteAllTextAsync(filePath, json, cancellationToken);
        }));
    }
}