namespace SmdgCli;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Schemas.Liners;
using Spectre.Console;
using Spectre.Console.Cli;

public class VerifyLinerCodesCommand : AsyncCommand<DefaultSettings>
{
    private readonly ILogger<VerifyLinerCodesCommand> _logger;

    public VerifyLinerCodesCommand(ILogger<VerifyLinerCodesCommand> logger)
    {
        _logger = logger;
    }
    
    public override async Task<int> ExecuteAsync(CommandContext context, DefaultSettings settings)
    {
        var linerJsonFileName = Path.Join(settings.OutputDirectory, "liner-codes.json");

        var jsonStream = File.OpenRead(linerJsonFileName);
        
        var linerCodes = await JsonSerializer.DeserializeAsync<List<LinerCode>>(jsonStream);

        if (linerCodes is null)
        {
            return 1;
        }
        
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