using Spectre.Console.Cli;

namespace SmdgCli;

public class DefaultSettings : CommandSettings
{
    [CommandOption("-o|--output")]
    public required string OutputDirectory { get; set; }

    [CommandOption("-t|--token")]
    public required string Token { get; set; }

    [CommandOption("-r|--repository")]
    public required string Repository { get; set; }
}