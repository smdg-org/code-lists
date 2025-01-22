namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class LinerCodesVerifyPullRequestSettings : DefaultSettings
{
    [CommandOption("-p|--pullrequest")]
    public required int PullRequest { get; set; }
}