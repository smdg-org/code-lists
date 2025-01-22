namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class LinerCodesConvertBulkSettings : DefaultSettings
{
    [CommandOption("-f|--file")]
    public required string FileName { get; set; }
}