namespace SmdgCli;

public static class DataSourcesExtensions
{
    public static DataSource? PickByVersion(this IEnumerable<DataSource>? dataSources, string releaseVersion)
    {
        var dataSourcesList = dataSources?.ToList() ?? [];

        if (!releaseVersion.Equals("latest", StringComparison.InvariantCultureIgnoreCase))
        {
            return dataSourcesList
                .FirstOrDefault(ds => ds.Version == releaseVersion);
        }

        return dataSourcesList
            .Select(ds => (dt: DateOnly.ParseExact(ds.Version, "yyyyMMdd"), ds: ds))
            .OrderByDescending(t => t.dt)
            .Select(t => t.ds)
            .FirstOrDefault();
    }
}