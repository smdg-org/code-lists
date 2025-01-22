namespace SmdgCli.Services;

public interface IFileStore
{
    Task<T?> TryReadAsync<T>(
        string code,
        string outputDirectory,
        CancellationToken cancellationToken = default);

    Task<IEnumerable<T>> ReadAllAsync<T>(
        string outputDirectory,
        bool readFromCombined = true,
        CancellationToken cancellationToken = default);

    Task UpsertSingleAsync<T>(
        string code,
        T record,
        string outputDirectory,
        CancellationToken cancellationToken = default);

    Task WriteAllAsync<T>(
        IEnumerable<T> records,
        string outputDirectory,
        Func<T, string> codeSelector,
        CancellationToken cancellationToken = default);

    Task RebuildCombined<T>(
        string outputDirectory,
        CancellationToken cancellationToken = default);
}