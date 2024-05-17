namespace SmdgCli.Services;

public interface IFileListWriter
{
    Task WriteAsync<T>(IEnumerable<T> records, string outputDirectory, Func<T, string> fileNameSelector, CancellationToken cancellationToken = default);
}