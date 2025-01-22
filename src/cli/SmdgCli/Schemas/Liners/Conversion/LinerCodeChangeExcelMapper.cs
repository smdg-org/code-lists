namespace SmdgCli.Schemas.Liners.Conversion;

using Services;

public class LinerCodeChangeExcelMapper : IExcelMapper<LinerCodeChangeExcel>
{
    public LinerCodeChangeExcel Map(IDictionary<string, string> source)
    {
        var lastUpdate = DateOnly.FromDateTime(DateTime.Parse(source["Last update"]));

        if (!source.TryGetValue("Action", out var action))
        {
            source.TryGetValue("action", out action);
        }

        return new LinerCodeChangeExcel
        {
            LastUpdate = lastUpdate,
            LinerCode = source["Liner Code"],
            Action = action ?? string.Empty,
            Company = source["Company"],
            Reason = source["Reason for change"],
            Comments = source["Comments"]
        };
    }

    public Dictionary<string, string> ReverseMap(LinerCodeChangeExcel source)
    {
        return new Dictionary<string, string>
        {
            ["Last update"] = source.LastUpdate.ToString("yyyy-MM-dd"),
            ["Liner Code"] = source.LinerCode,
            ["Action"] = source.Action,
            ["Company"] = source.Company,
            ["Reason for change"] = source.Reason,
            ["Comments"] = source.Comments ?? string.Empty
        };
    }
}