namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class LinerCodesPackExcelSettings : DefaultSettings
{
    [CommandOption("-n|--number")]
    public required int RunNumber { get; set; }
    
    [CommandOption("-b|--branch")]
    public required string Branch { get; set; }
}