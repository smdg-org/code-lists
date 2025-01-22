namespace SmdgCli.Schemas.Liners;

using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

/// <summary>
/// Nullability has been introduced to accommodate a broader range of use cases.
/// </summary>
public record Address
{
    [MaxLength(100)]
    [Description("The name of the street of the party’s address.")]
    [JsonPropertyName("street")]
    public string? Street { get; set; }

    [MaxLength(50)]
    [Description("The number of the street of the party’s address.")]
    [JsonPropertyName("streetNumber")]
    public string? StreetNumber { get; set; }

    [MaxLength(50)]
    [Description("The floor of the party’s street number.")]
    [JsonPropertyName("floor")]
    public string? Floor { get; set; }

    [MaxLength(50)]
    [Description("The post code of the party’s address.")]
    [JsonPropertyName("postCode")]
    public string? PostCode { get; set; }

    [MaxLength(65)]
    [Description("The city name of the party’s address.")]
    [JsonPropertyName("city")]
    public string? City { get; set; }

    [MaxLength(65)]
    [Description("The state/region of the party’s address.")]
    [JsonPropertyName("state")]
    public string? State { get; set; }

    [MaxLength(75)]
    [Description("The country name of the party’s address.")]
    [JsonPropertyName("country")]
    public string? Country { get; set; }
}