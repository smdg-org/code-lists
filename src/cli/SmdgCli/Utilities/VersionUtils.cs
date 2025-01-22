namespace SmdgCli.Utilities;

public class VersionUtils
{
    public static string FirstVersion() => "V1";

    public static string NextVersion(string version)
    {
        if (string.IsNullOrEmpty(version))
        {
            throw new ArgumentException("Version cannot be null or empty.", nameof(version));
        }

        if (version.Length > 1 && version[0] == 'V' && int.TryParse(version.AsSpan(1), out var number))
        {
            return $"V{number + 1}";
        }

        throw new FormatException("Invalid version format. Expected format: 'V<number>'.");
    }

    public static string GetReleaseVersion(int runNumber, bool isBeta)
    {
        var date = DateTimeOffset.UtcNow.ToString("yyyyMMdd");
        return $"{date}-{runNumber}{(isBeta ? "-beta" : "")}";
    }
}