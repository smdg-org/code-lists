namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class LinerCodesConvertFormExcelSettings : DefaultSettings
{
    [CommandOption("-i|--issue")]
    public required int IssueNumber { get; set; }

    [CommandOption("-f|--file")]
    public required string LocalFileName { get; set; }
}