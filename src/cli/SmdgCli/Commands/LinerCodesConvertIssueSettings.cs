namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class LinerCodesConvertIssueSettings : DefaultSettings
{
    [CommandOption("-i|--issue")]
    public required int IssueNumber { get; set; }
}