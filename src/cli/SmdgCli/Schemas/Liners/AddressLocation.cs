namespace SmdgCli.Schemas.Liners;

using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

public record AddressLocation
{
    [MaxLength(5)]
    [Description("The UN Location code specifying where the place is located.")]
    [JsonPropertyName("UNLocationCode")]
    public required string UnLocationCode { get; set; }

    [MaxLength(100)]
    [Description("The name of the location.")]
    [JsonPropertyName("locationName")]
    public required string LocationName { get; set; }
    
    [Description("Address related information.")]
    [JsonPropertyName("address")]
    public required Address Address { get; set; }
};