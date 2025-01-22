namespace SmdgCli.Schemas.Liners;

using System.ComponentModel;
using System.Text.Json.Serialization;

public record ChangedField
{
    [Description("The name of the field that was changed.")]
    [JsonPropertyName("fieldName")]
    public required string FieldName { get; set; }

    [Description("The previous value of the field.")]
    [JsonPropertyName("previousValue")]
    public string? PreviousValue { get; set; }

    [Description("The current value of the field.")]
    [JsonPropertyName("currentValue")]
    public required string CurrentValue { get; set; }
}