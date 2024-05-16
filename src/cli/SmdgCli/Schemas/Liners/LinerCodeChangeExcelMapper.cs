namespace SmdgCli.Schemas.Liners;

using Services;

public class LinerCodeChangeExcelMapper : IExcelMapper<LinerCodeChangeExcel>
{
    public LinerCodeChangeExcel Map(IDictionary<string, string> source)
    {
        var lastUpdate = DateTime.Parse(source["Last update"]);

        return new LinerCodeChangeExcel
        {
            LastUpdate = lastUpdate,
            LinerCode = source["Liner Code"],
            Action = source["action"],
            Company = source["Company"],
            Reason = source["Reason for change"],
            Comments = source["Comments"]
        };
    }
}