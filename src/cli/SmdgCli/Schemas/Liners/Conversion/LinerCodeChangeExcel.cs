namespace SmdgCli.Schemas.Liners.Conversion;

public record LinerCodeChangeExcel
{
    public DateOnly LastUpdate { get; set; }

    public required string LinerCode { get; set; }

    public required string Action { get; set; }

    public required string Company { get; set; }

    public required string Reason { get; set; }

    public string? Comments { get; set; }

    public static readonly IEnumerable<string> ExpectedHeaders
        = ["Code", "action", "Company", "Reason"];
}