namespace SmdgCli;

public class DataSourcesConfig
{
    public DataSources? DataSources { get; set; }
}

public class DataSources
{
    public IEnumerable<DataSource>? LinerCodes { get; set; }
}

public class DataSource
{
    public string Url { get; set; } = null!;

    public string CacheFile { get; set; } = null!;

    public string Version { get; set; } = null!;
}