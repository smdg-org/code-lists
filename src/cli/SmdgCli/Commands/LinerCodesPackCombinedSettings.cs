namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class LinerCodesPackCombinedSettings : CommandSettings
{
    [CommandOption("-o|--output")]
    public required string OutputDirectory { get; set; }
}