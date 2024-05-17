namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class ConvertLinerCodesSettings : DefaultSettings
{
    [CommandOption("-r|--release")]
    public string Release { get; set; } = "latest";
}