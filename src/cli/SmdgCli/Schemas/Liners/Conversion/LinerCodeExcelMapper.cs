namespace SmdgCli.Schemas.Liners.Conversion;

using SmdgCli.Services;

public class LinerCodeExcelMapper : IExcelMapper<LinerCodeExcel>
{
    public LinerCodeExcel Map(IDictionary<string, string> source)
    {
        var lastChanged = string.IsNullOrWhiteSpace(source["Last change"])
            ? (DateOnly?)null
            : DateOnly.FromDateTime(DateTime.Parse(source["Last change"]));

        var validFrom = string.IsNullOrWhiteSpace(source["Valid from"])
            ? (DateOnly?)null
            : DateOnly.FromDateTime(DateTime.Parse(source["Valid from"]));

        var validTo = string.IsNullOrWhiteSpace(source["Valid until"])
            ? (DateOnly?)null
            : DateOnly.FromDateTime(DateTime.Parse(source["Valid until"]));

        return new LinerCodeExcel
        {
            Code = source["Code"].Trim()[..3],
            Line = source["Line"],
            ParentCompany = source["Parent company"],
            Nvocc = source["NVOCC"].Trim().Contains('x', StringComparison.InvariantCultureIgnoreCase),
            Vocc = source["VOCC"].Trim().Contains('x', StringComparison.InvariantCultureIgnoreCase),
            LastChange = lastChanged,
            ValidFrom = validFrom,
            ValidUntil = validTo,
            Website = source["Website"],
            Address = source["Address"],
            Remarks = source["Remarks"],
            // New data model
            Street = source["Street"],
            StreetNumber = source["No."],
            Floor = source["Building/Suite/Floor"],
            ZipCode = source["Zip code"],
            City = source["City"],
            StateRegion = source["State/Region"],
            Country = source["Country"],
            UnCountryCode = source["UN Country Code"],
            UnLocationCode = source["UN Location Code"],
            IsActive = source["Active"].Trim().Contains("active", StringComparison.InvariantCultureIgnoreCase)
        };
    }

    public Dictionary<string, string> ReverseMap(LinerCodeExcel source)
    {
        return new Dictionary<string, string>
        {
            ["Code"] = source.Code,
            ["Line"] = source.Line,
            ["Parent company"] = source.ParentCompany ?? string.Empty,
            ["NVOCC"] = source.Nvocc ? "X" : "",
            ["VOCC"] = source.Vocc ? "X" : "",
            ["Last change"] = source.LastChange?.ToString("yyyy-MM-dd") ?? "",
            ["Valid from"] = source.ValidFrom?.ToString("yyyy-MM-dd") ?? "",
            ["Valid until"] = source.ValidUntil?.ToString("yyyy-MM-dd") ?? "",
            ["Website"] = source.Website,
            ["Address"] = source.Address,
            ["Remarks"] = source.Remarks,
            // New data model
            ["Street"] = source.Street ?? string.Empty,
            ["No."] = source.StreetNumber ?? string.Empty,
            ["Building/Suite/Floor"] = source.Floor ?? string.Empty,
            ["Zip code"] = source.ZipCode ?? string.Empty,
            ["City"] = source.City ?? string.Empty,
            ["State/Region"] = source.StateRegion ?? string.Empty,
            ["Country"] = source.Country ?? string.Empty,
            ["UN Country Code"] = source.UnCountryCode ?? string.Empty,
            ["UN Location Code"] = source.UnLocationCode ?? string.Empty,
            ["Active"] = source.IsActive ? "active" : ""
        };
    }
}