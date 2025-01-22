namespace SmdgCli.Schemas.Liners.Conversion;

using System.Text.Json.Serialization;

public class LinerCodeForm
{
    [JsonPropertyName("Change Type")]
    public string? ChangeType { get; set; }
    
    [JsonPropertyName("Requester")]
    public string? Requester { get; set; }

    [JsonPropertyName("Change Reason")]
    public string? ChangeReason { get; set; }

    [JsonPropertyName("Liner Code")]
    public string? LinerCode { get; set; }

    [JsonPropertyName("Liner Name")]
    public string? LinerName { get; set; }

    [JsonPropertyName("Carrier Type")]
    public string? CarrierType { get; set; }

    [JsonPropertyName("Parent Company")]
    public string? ParentCompany { get; set; }

    #region Address Location
    [JsonPropertyName("Unstructured Address")]
    public string? UnstructuredAddress { get; set; }
    
    [JsonPropertyName("UN/LOCODE")]
    public string? UnLoCode { get; set; }

    [JsonPropertyName("UN Country Code")]
    public string? UnCountryCode { get; set; }

    [JsonPropertyName("Street")]
    public string? Street { get; set; }

    [JsonPropertyName("Street Number")]
    public string? StreetNumber { get; set; }

    [JsonPropertyName("Floor")]
    public string? Floor { get; set; }

    [JsonPropertyName("Postal Code")]
    public string? PostalCode { get; set; }

    [JsonPropertyName("City")]
    public string? City { get; set; }

    [JsonPropertyName("State")]
    public string? State { get; set; }

    [JsonPropertyName("Country")]
    public string? Country { get; set; }
    #endregion

    [JsonPropertyName("Website")]
    public string? Website { get; set; }

    [JsonPropertyName("Remarks")]
    public string? Remarks { get; set; }

    [JsonPropertyName("Valid From")]
    public string? ValidFrom { get; set; }

    [JsonPropertyName("Valid To")]
    public string? ValidTo { get; set; }
    
    [JsonPropertyName("Linked Liner Code")]
    public string? LinkedLinerCode { get; set; }

    [JsonPropertyName("Change Comments")]
    public string? ChangeComments { get; set; }
}