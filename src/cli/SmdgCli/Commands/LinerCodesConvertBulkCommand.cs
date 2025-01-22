namespace SmdgCli.Commands;

using Schemas.Liners.Conversion;
using Services;
using Spectre.Console;
using Spectre.Console.Cli;
using Utilities;

public class LinerCodesConvertBulkCommand(
    IExcelFile excelFile,
    IExcelMapper<LinerCodeExcel> codeExcelMapper,
    IExcelMapper<LinerCodeChangeExcel> changeExcelMapper,
    LinerCodeMapper linerCodeMapper,
    IFileStore fileStore)
    : AsyncCommand<LinerCodesConvertBulkSettings>
{
    public override async Task<int> ExecuteAsync(
        CommandContext context,
        LinerCodesConvertBulkSettings settings)
    {
        AnsiConsole.Write(new FigletText("SMDG Liner Codes").Centered().Color(Color.DeepPink3));

        AnsiConsole.MarkupLine($"Converting Liner Codes from: [deeppink3]{settings.FileName}[/]");

        CacheDirectory.Ensure(settings.OutputDirectory);

        AnsiConsole.MarkupLine($"Converting excel to intermediate json files: [deeppink3]{settings.OutputDirectory}[/]");

        var data = excelFile.ReadMultipleSheets(
            settings.FileName,
            "Codes",
            "Change Log",
            LinerCodeExcel.ExpectedHeaders,
            LinerCodeChangeExcel.ExpectedHeaders,
            Path.Combine(settings.OutputDirectory, CacheDirectory.Name));
        if (data is null)
        {
            AnsiConsole.MarkupLine("[red]Failed to convert Liner Codes[/]");
            return 1;
        }

        var codesExcel = data.Codes
            .Select(codeExcelMapper.Map)
            .ToList();
        
        var changesExcel = data.Changes
            .Select(changeExcelMapper.Map)
            .ToList();

        AnsiConsole.MarkupLine($"Total codes found: [deeppink3]{codesExcel.Count}[/]");


        AnsiConsole.MarkupLine($"Writing code list to folder: [deeppink3]{settings.OutputDirectory}[/]");

        var finalCodeList = codesExcel
            .Select(c => linerCodeMapper.Map(c,
                changesExcel.Where(ch => ch.LinerCode == c.Code)))
            .ToList();

        await fileStore.WriteAllAsync(
            finalCodeList,
            settings.OutputDirectory,
            c => c.LinerSmdgCode);

        AnsiConsole.MarkupLine($"Saved files: [deeppink3]{finalCodeList.Count}[/]");

        return 0;
    }
}