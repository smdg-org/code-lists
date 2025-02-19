namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class LinerCodesConvertFormMarkdownSettings : DefaultSettings
{
    [CommandOption("-i|--issue")]
    public required int IssueNumber { get; set; }
}