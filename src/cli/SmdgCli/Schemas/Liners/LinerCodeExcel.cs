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
    
    // New Data Model
    public string Street { get; set; }

    public string StreetNumber { get; set; }

    public string Floor { get; set; }

    public string ZipCode { get; set; }

    public string City { get; set; }

    public string StateRegion { get; set; }

    public string Country { get; set; }

    public string UnCountryCode { get; set; }

    public string UnLocationCode { get; set; }

    public bool IsActive { get; set; }
}