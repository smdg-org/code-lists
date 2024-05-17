namespace SmdgCli.Schemas.Liners;

public record LinerCodeExcel
{
    public required string Code { get; set; }

    public required string Line { get; set; }

    public required string ParentCompany { get; set; }

    public required bool Nvocc { get; set; }

    public required bool Vocc { get; set; }

    public DateTime? LastChange { get; set; }

    public DateTime? ValidFrom { get; set; }

    public DateTime? ValidUntil { get; set; }

    public required string Website { get; set; }

    public required string Address { get; set; }

    public required string Remarks { get; set; }
}