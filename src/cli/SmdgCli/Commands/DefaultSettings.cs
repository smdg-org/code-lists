using Spectre.Console.Cli;

namespace SmdgCli;

public class DefaultSettings : CommandSettings
{
    [CommandOption("-o|--output")]
    public string? OutputDirectory { get; set; }
}