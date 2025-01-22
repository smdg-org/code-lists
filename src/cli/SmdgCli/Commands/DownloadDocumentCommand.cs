namespace SmdgCli.Commands;

using Services;
using Spectre.Console;
using Spectre.Console.Cli;
using Utilities;

public class DownloadDocumentCommand(IRemoteFileReader remoteFileReader)
    : AsyncCommand<DownloadDocumentSettings>
{
    public override async Task<int> ExecuteAsync(CommandContext context, DownloadDocumentSettings settings)
    {
        try
        {
            CacheDirectory.Ensure(settings.OutputDirectory);
        
            var filePath = Path.Combine(settings.OutputDirectory, CacheDirectory.Name, settings.FileName);

            await remoteFileReader.DownloadFile(filePath, settings.Url);
            return 0;
        }
        catch (Exception ex)
        {
            AnsiConsole.MarkupLine($"[red]Error: {ex.Message}[/]");
            return 1;
        }
    }
}