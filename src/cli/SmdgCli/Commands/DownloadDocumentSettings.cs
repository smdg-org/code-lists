namespace SmdgCli.Commands;

using Spectre.Console.Cli;

public class DownloadDocumentSettings : CommandSettings
{
    [CommandOption("-u|--url")]
    public required string Url { get; set; }

    [CommandOption("-f|--file")]
    public required string FileName { get; set; }
    
    [CommandOption("-o|--output")]
    public required string OutputDirectory { get; set; }
}