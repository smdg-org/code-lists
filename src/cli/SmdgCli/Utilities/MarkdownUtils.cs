namespace SmdgCli.Utilities;

using System.Text.Json;
using System.Text.Json.Serialization;

public static class Markdown
{
    public static T? ParseForm<T>(string markdown)
    {
        var json = ParseForm(markdown);
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions()
        {
            PropertyNameCaseInsensitive = true,
        });
    }

    public static string ParseForm(string markdown)
    {
        var data = new Dictionary<string, string?>();
        var lines = markdown.Split(["\r\n", "\n"], StringSplitOptions.RemoveEmptyEntries);

        var currentKey = (string?)null;
        foreach (var line in lines)
        {
            if (line.StartsWith("###"))
            {
                // Extract key
                currentKey = line[3..].Trim();
            }
            else if (currentKey != null)
            {
                // Extract value and add to dictionary
                data[currentKey] = line.Trim();
                currentKey = null;
            }
        }

        foreach (var field in data)
        {
            if (field.Value is null || !field.Value.Equals("_No response_", StringComparison.InvariantCultureIgnoreCase))
            {
                continue;
            }

            data[field.Key] = null;
        }
        
        var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            WriteIndented = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        });

        return json;
    }
}