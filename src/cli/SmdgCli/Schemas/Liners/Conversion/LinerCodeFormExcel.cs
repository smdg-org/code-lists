namespace SmdgCli.Schemas.Liners.Conversion;

using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Utilities;

public class LinerCodeFormExcel
{
    [JsonPropertyName("Change Type")]
    public string? ChangeType { get; set; }

    [JsonPropertyName("Liner Code")]
    public string? LinerCode { get; set; }

    [JsonPropertyName("Requester")]
    public string? Requester { get; set; }

    [JsonPropertyName("Form attachment")]
    public string? FormAttachment { get; set; }

    public LinerCodeForm AsNormal(Dictionary<string, string> data)
    {
        data.TryGetValue("Reason", out var reason);
        data.TryGetValue("Comments", out var comments);
    
        return new LinerCodeForm()
        {
            ChangeType = ChangeType,
            LinerCode = LinerCode,
            Requester = Requester,
            // Excel data
            LinerName = data["Line"],
            ParentCompany = data["Parent company"],
            CarrierType = data.OptionalString("VOCC").IsMarked()
                ? CarrierType.VOCC.ToString()
                : (data.OptionalString("NVOCC").IsMarked()
                    ? CarrierType.NVOCC.ToString()
                    : string.Empty),
            ValidFrom = data["Valid from"],
            ValidTo = data["Valid until"],
            Website = data["Website"],
            UnstructuredAddress = data["Address"],
            Remarks = data["Remarks"],
            ChangeReason = reason ?? string.Empty,
            ChangeComments = comments ?? string.Empty,
        };
    }

    public static readonly IEnumerable<string> ExpectedHeaders
        = ["Code", "Line", "Valid from", "Address", "Applicant/Contact"];
}