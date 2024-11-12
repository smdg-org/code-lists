namespace SmdgCli.Schemas.Liners;

using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

public record Address
{
    [MaxLength(100)]
    [Description("Name of the address.")]
    [JsonPropertyName("name")]
    public required string Name { get; set; }

    [MaxLength(100)]
    [Description("The name of the street of the party’s address.")]
    [JsonPropertyName("street")]
    public required string Street { get; set; }

    [MaxLength(50)]
    [Description("The number of the street of the party’s address.")]
    [JsonPropertyName("streetNumber")]
    public required string StreetNumber { get; set; }

    [MaxLength(50)]
    [Description("The floor of the party’s street number.")]
    [JsonPropertyName("floor")]
    public required string Floor { get; set; }

    [MaxLength(50)]
    [Description("The post code of the party’s address.")]
    [JsonPropertyName("postCode")]
    public required string PostCode { get; set; }

    [MaxLength(65)]
    [Description("The city name of the party’s address.")]
    [JsonPropertyName("city")]
    public required string City { get; set; }

    [MaxLength(65)]
    [Description("The state/region of the party’s address.")]
    [JsonPropertyName("state")]
    public required string State { get; set; }

    [MaxLength(75)]
    [Description("The country name of the party’s address.")]
    [JsonPropertyName("country")]
    public required string Country { get; set; }
}