namespace SmdgCli.Schemas.Liners;

using System.ComponentModel;
using System.Text.Json.Serialization;

public record LinerCode
{
    [JsonPropertyName("isActive")]
    public required bool IsActive { get; set; }

    [Description("The status of the liner code.")]
    [JsonPropertyName("codeStatus")]
    public required CodeStatusEnum CodeStatus { get; set; }

    [Description("The version of the given Liner code as per SMDG updates.")]
    [JsonPropertyName("linerCodeVersion")]
    public required string LinerCodeVersion { get; set; }

    [Description("Unique code for a shipping line, created and maintained by SMDG for each of the line.")]
    [JsonPropertyName("linerSMDGCode")]
    public required string LinerSmdgCode { get; set; }

    [Description("Line name provided a part of the line code creation request and approved by SMDG.")]
    [JsonPropertyName("linerName")]
    public required string LinerName { get; set; }
    
    [Description("Carrier type.")]
    [JsonPropertyName("carrierType")]
    public CarrierType? CarrierType { get; set; }

    [Description("Parent company name of a subsidiary company. The parent company is only listed if the inclusion rules for this list apply and it is also listed here.")]
    [JsonPropertyName("parentCompany")]
    public string? ParentCompany { get; set; }

    [Description("The single-line unstructured address details.")]
    [JsonPropertyName("address")]
    public required string UnstructuredAddress { get; set; }

    [Description("Address location of the liner code.")]
    [JsonPropertyName("addressLocation")]
    public required AddressLocation AddressLocation { get; set; }

    [Description("Line website, provided by the liner coder requestor and confirmed by SMDG.")]
    [JsonPropertyName("website")]
    public required string Website { get; set; }

    [Description("Additional remarks.")]
    [JsonPropertyName("remarks")]
    public required string Remarks { get; set; }

    [Description("Validity start of liner code.")]
    [JsonPropertyName("validFrom")]
    public required DateOnly ValidFrom { get; set; }

    [Description("Validity end of liner code.")]
    [JsonPropertyName("validTo")]
    public DateOnly? ValidTo { get; set; }

    [Description("Change log indicating the different changes per version.")]
    [JsonPropertyName("changeLogs")]
    public required IList<ChangeLog> ChangeLogs { get; set; }
}