namespace SmdgCli.Schemas.Liners;

using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

/// <summary>
/// Nullability has been introduced to accommodate a broader range of use cases.
/// </summary>
public record AddressLocation
{
    [MaxLength(5)]
    [Description("The UN Location code specifying where the place is located.")]
    [JsonPropertyName("UnLocode")]
    public string? UnLocode { get; set; }

    [MaxLength(2)]
    [Description("The UN Country code specifying where the place is located.")]
    [JsonPropertyName("UnCountryCode")]
    public string? UnCountryCode { get; set; }

    [Description("Address related information.")]
    [JsonPropertyName("address")]
    public Address? Address { get; set; }
};