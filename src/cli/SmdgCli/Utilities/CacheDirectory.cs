namespace SmdgCli.Utilities;

public static class CacheDirectory
{
    public const string Name = "cache";
    
    public static void Ensure(string dataDirectory)
    {
        var cacheDirectory = Path.Join(dataDirectory, Name);
        if (!Directory.Exists(cacheDirectory))
        {
            Directory.CreateDirectory(cacheDirectory);
        }
    }
}