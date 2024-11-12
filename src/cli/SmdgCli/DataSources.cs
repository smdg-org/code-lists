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
    public string Address { get; set; } = null!;

    public string FileName { get; set; } = null!;

    public string Version { get; set; } = null!;
}