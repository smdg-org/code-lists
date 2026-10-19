namespace SmdgCli.Utilities;

public static class RepositoryPathUtils
{
    public static string GetRepositoryRoot()
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (directory is not null &&
               !Directory.Exists(Path.Combine(directory.FullName, ".git")) &&
               !File.Exists(Path.Combine(directory.FullName, ".git")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? Directory.GetCurrentDirectory();
    }

    public static string NormalizeRepositoryRelativePath(string path, string repositoryRoot)
    {
        var relativePath = Path.GetRelativePath(repositoryRoot, Path.GetFullPath(path));

        return relativePath
            .Replace(Path.DirectorySeparatorChar, '/')
            .Replace(Path.AltDirectorySeparatorChar, '/')
            .TrimEnd('/');
    }
}
