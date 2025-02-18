namespace SmdgCli.Commands;

using Schemas.Liners;
using Services;
using Spectre.Console;
using Spectre.Console.Cli;

public class LinerCodesVerifyAllCommand(IFileStore fileStore)
    : AsyncCommand<DefaultSettings>
{
    public override async Task<int> ExecuteAsync(CommandContext context, DefaultSettings settings)
    {
        var linerCodes = await fileStore.ReadAllAsync<LinerCode>(settings.OutputDirectory);
        var anyInvalid = false;

        foreach (var linerCode in linerCodes)
        {
            var validationResult = await new LinerCodeValidator()
                .ValidateAsync(linerCode);

            if (!validationResult.IsValid)
            {
                anyInvalid = true;
                
                AnsiConsole.MarkupLine($"[red]Liner information is invalid for code {linerCode.LinerSmdgCode}[/]");
                
                validationResult.Errors.ForEach(e =>
                {
                   AnsiConsole.MarkupLine($"[deeppink3]{e.ErrorMessage}[/]");
                });
            }
        }

        if (!anyInvalid)
        {
            AnsiConsole.MarkupLine("[green]All liner codes are valid.[/]");
            return 0;
        }

        return 1;
    }
}