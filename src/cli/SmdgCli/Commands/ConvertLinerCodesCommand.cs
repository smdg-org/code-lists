namespace SmdgCli.Commands;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Schemas.Liners;
using Services;
using Spectre.Console;
using Spectre.Console.Cli;

public class ConvertLinerCodesCommand: AsyncCommand<ConvertLinerCodesSettings>
{
    private readonly ILogger<ConvertLinerCodesCommand> _logger;
    private readonly IFileConverter _fileConverter;
    private readonly IExcelMapper<LinerCodeExcel> _codeExcelMapper;
    private readonly IExcelMapper<LinerCodeChangeExcel> _changeExcelMapper;
    private readonly LinerCodeMapper _linerCodeMapper;
    private readonly IFileListWriter _fileListWriter;
    private readonly IEnumerable<DataSource>? _linerCodeDataSources;
    
    private static readonly IEnumerable<string> ExpectedHeadersForMain = new[]{ "Code", "Line", "Company", "Valid from", "Address" };
    private static readonly IEnumerable<string> ExpectedHeadersForChanges = new[]{ "Code", "action", "Company", "Reason" };

    public ConvertLinerCodesCommand(
        ILogger<ConvertLinerCodesCommand> logger,
        IOptions<DataSources> options,
        IFileConverter fileConverter,
        IExcelMapper<LinerCodeExcel> codeExcelMapper,
        IExcelMapper<LinerCodeChangeExcel> changeExcelMapper,
        LinerCodeMapper linerCodeMapper,
        IFileListWriter fileListWriter)
    {
        _logger = logger;
        _fileConverter = fileConverter;
        _codeExcelMapper = codeExcelMapper;
        _changeExcelMapper = changeExcelMapper;
        _linerCodeMapper = linerCodeMapper;
        _fileListWriter = fileListWriter;
        _linerCodeDataSources = options.Value.LinerCodes;
    }

    public override async Task<int> ExecuteAsync(CommandContext context, ConvertLinerCodesSettings settings)
    {
        if (_linerCodeDataSources is null)
        {
            throw new InvalidOperationException("Data source for Liner Codes is not valid");
        }

        AnsiConsole.Write(new FigletText("SMDG Liner Codes").Centered().Color(Color.DeepPink3));

        AnsiConsole.MarkupLine($"Converting Liner Codes for release: [deeppink3]{settings.Release}[/]");

        var latestDataSource = _linerCodeDataSources.PickByVersion(settings.Release);
        if (latestDataSource is null)
        {
            AnsiConsole.MarkupLine("[red]No data source found for the specified release[/]");
            return 1;
        }

        var cacheDirectory = Path.Join(settings.OutputDirectory, "cache");
        if (!Directory.Exists(cacheDirectory))
        {
            Directory.CreateDirectory(cacheDirectory);
        }

        AnsiConsole.MarkupLine($"Converting excel to intermediate json files: [deeppink3]{cacheDirectory}[/]");

        var jsonMain = await _fileConverter.ExcelToJson(
            latestDataSource,
            latestDataSource.Version,
            ExpectedHeadersForMain,
            _codeExcelMapper,
            cacheDirectory);
        if (jsonMain is null)
        {
            AnsiConsole.MarkupLine("[red]Failed to convert Liner Codes[/]");
            return 1;
        }

        var codes = JsonSerializer.Deserialize<IEnumerable<LinerCodeExcel>>(jsonMain?.Content!);
        if (codes is null)
        {
            AnsiConsole.MarkupLine("[red]Failed to deserialize Liner Codes[/]");
            return 1;
        }

        var jsonChanges = await _fileConverter.ExcelToJson(
            latestDataSource,
            "Change Log",
            ExpectedHeadersForChanges,
            _changeExcelMapper,
            cacheDirectory);
        if (jsonChanges is null)
        {
            AnsiConsole.MarkupLine("[red]Failed to convert Liner Code changes[/]");
            return 1;
        }

        var changes = JsonSerializer.Deserialize<IEnumerable<LinerCodeChangeExcel>>(jsonChanges?.Content!);
        if (changes is null)
        {
            AnsiConsole.MarkupLine("[red]Failed to deserialize Liner Code changes[/]");
            return 1;
        }

        AnsiConsole.MarkupLine($"Writing code list to folder: [deeppink3]{settings.OutputDirectory}[/]");

        var finalCodeList = codes
            .Select(c => _linerCodeMapper.Map(c, changes.Where(ch => ch.LinerCode == c.Code)))
            .ToList();

        await _fileListWriter.WriteAsync(
            finalCodeList,
            settings.OutputDirectory,
            c => $"{c.SmdgLinerId}.json");

        AnsiConsole.MarkupLine($"Saved files: [deeppink3]{finalCodeList.Count}[/]");

        return 0;
    }
}