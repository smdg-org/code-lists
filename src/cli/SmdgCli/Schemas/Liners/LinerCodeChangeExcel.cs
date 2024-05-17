namespace SmdgCli.Schemas.Liners;

public record LinerCodeChangeExcel
{
    public DateTime LastUpdate { get; set; }

    public required string LinerCode { get; set; }

    public required string Action { get; set; }

    public required string Company { get; set; }

    public required string Reason { get; set; }

    public required string Comments { get; set; }
}