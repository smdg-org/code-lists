namespace SmdgCli.Schemas.Liners;

using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

public record ChangeLog
{
    [MaxLength(50)]
    [Description("Represents the performed action (UPDATE/CODE CHANGE...).")]
    [JsonPropertyName("actionCode")]
    public required ActionCodeEnum ActionCode { get; set; }

    [Description("The version of the given Liner code as per SMDG updates.")]
    [JsonPropertyName("linerCodeVersion")]
    public required string LinerCodeVersion { get; set; }

    [Description("Latest updated date.")]
    [JsonPropertyName("lastUpdateDate")]
    public required DateOnly LastUpdateDate { get; set; }

    [MaxLength(50)]
    [Description("User/group responsible for requesting the update.")]
    [JsonPropertyName("updateRequestedBy")]
    public string? UpdateRequestedBy { get; set; }

    [MaxLength(3)]
    [Description("Previous or new Liner code related to this liner code version.")]
    [JsonPropertyName("linkedLinerCode")]
    public string? LinkedLinerCode { get; set; }

    [Description("Brief description of the reason for the performed action.")]
    [JsonPropertyName("reason")]
    public required string Reason { get; set; }

    [MaxLength(100)]
    [Description("Any additional comments needed.")]
    [JsonPropertyName("comments")]
    public string? Comments { get; set; }
}