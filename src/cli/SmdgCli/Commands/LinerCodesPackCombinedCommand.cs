namespace SmdgCli.Commands;

using Schemas.Liners;
using Services;
using Spectre.Console;
using Spectre.Console.Cli;

public class LinerCodesPackCombinedCommand(IFileStore fileStore)
    : AsyncCommand<LinerCodesPackCombinedSettings>
{
    public override async Task<int> ExecuteAsync(CommandContext context, LinerCodesPackCombinedSettings settings)
    {
        AnsiConsole.WriteLine("Packing combined Liner Codes");
        try
        {
            await fileStore.RebuildCombined<LinerCode>(settings.OutputDirectory);
            AnsiConsole.WriteLine("Packing completed");
            return 0;
        }
        catch (Exception ex)
        {
            AnsiConsole.WriteException(ex);
            return 1;
        }
    }
}