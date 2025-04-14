namespace SmdgCli.Utilities;

public static class DataUtils
{
    public static string? OptionalString(this IDictionary<string, string> source, string key) =>
        source.TryGetValue(key, out var value) ? value : null;

    public static DateOnly? OptionalDateOnly(this IDictionary<string, string> source, string key) =>
        source.OptionalString(key).ToDateOnly();

    public static DateOnly? ToDateOnly(this string? value) =>
        !string.IsNullOrWhiteSpace(value)
            ? DateOnly.FromDateTime(DateTime.Parse(value))
            : null;

    public static bool IsMarked(this string? value)
    {
        var lowerValue = value?.ToLower()?.Trim();
        return !string.IsNullOrWhiteSpace(lowerValue) && lowerValue is "x" or "yes";
    }
}