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
            Remarks = source["Remarks"]
        };
    }
}