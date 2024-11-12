namespace SmdgCli.Schemas.Liners;

using Services;

public class LinerCodeExcelMapper : IExcelMapper<LinerCodeExcel>
{
    public LinerCodeExcel Map(IDictionary<string, string> source)
    {
        var lastChanged = string.IsNullOrWhiteSpace(source["Last change"])
            ? (DateTime?)null
            : DateTime.Parse(source["Last change"]);

        var validFrom = string.IsNullOrWhiteSpace(source["Valid from"])
            ? (DateTime?)null
            : DateTime.Parse(source["Valid from"]);

        var validTo = string.IsNullOrWhiteSpace(source["Valid until"])
            ? (DateTime?)null
            : DateTime.Parse(source["Valid until"]);

        return new LinerCodeExcel
        {
            Code = source["Code"],
            Line = source["Line"],
            ParentCompany = source["Parent company"], 
            Nvocc = source["NVOCC"].Trim().Contains('x', StringComparison.InvariantCultureIgnoreCase),
            Vocc = source["VOCC"].Trim().Contains('X', StringComparison.InvariantCultureIgnoreCase),
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
}