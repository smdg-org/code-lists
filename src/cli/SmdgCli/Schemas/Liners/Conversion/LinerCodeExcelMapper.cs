namespace SmdgCli.Schemas.Liners.Conversion;

using SmdgCli.Services;
using Utilities;

public class LinerCodeExcelMapper : IExcelMapper<LinerCodeExcel>
{
    public LinerCodeExcel Map(IDictionary<string, string> source)
    {
        return new LinerCodeExcel
        {
            Code = source["Code"].Trim()[..3],
            Line = source["Line"].Trim(),
            ParentCompany = source["Parent company"].Trim(),
            Nvocc = source["NVOCC"].Trim().Contains('x', StringComparison.InvariantCultureIgnoreCase),
            Vocc = source["VOCC"].Trim().Contains('x', StringComparison.InvariantCultureIgnoreCase),
            LastChange = source.OptionalDateOnly("Last change"),
            ValidFrom = source.OptionalDateOnly("Valid from"),
            ValidUntil = source.OptionalDateOnly("Valid until"),
            Website = source["Website"],
            Address = source["Address"],
            Remarks = source["Remarks"],
            // New data model
            Street = source.OptionalString("Street"),
            StreetNumber = source.OptionalString("No."),
            Floor = source.OptionalString("Building/Suite/Floor"),
            ZipCode = source.OptionalString("Zip code"),
            City = source.OptionalString("City"),
            StateRegion = source.OptionalString("State/Region"),
            Country = source.OptionalString("Country"),
            UnCountryCode = source.OptionalString("UN Country Code"),
            UnLocationCode = source.OptionalString("UN Location Code"),
            IsActive = source.OptionalString("Active")?.Trim().Contains("active", StringComparison.InvariantCultureIgnoreCase) ?? true,
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