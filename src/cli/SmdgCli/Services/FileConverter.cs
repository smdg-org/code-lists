namespace SmdgCli.Services;

using Infrastructure;
using System.Text.Json;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using OpenXML;
using Spectre.Console;

public partial class FileConverter : IFileConverter
{
    private readonly IRemoteFileReader _remoteFileReader;

    public FileConverter(IRemoteFileReader remoteFileReader)
    {
        _remoteFileReader = remoteFileReader;
    }

    public async Task<(string File, string Content)?> ExcelToJson<TResult>(
        DataSource source,
        string sheetName,
        IEnumerable<string> expectedHeaders,
        IExcelMapper<TResult> excelMapper,
        string outputDirectory)
    {
        try
        {
            AnsiConsole.MarkupLine($"Converting source: [deeppink3]{source.Url}[/]");

            var cacheFullPath = Path.Join(outputDirectory, source.CacheFile);

            var stream = await _remoteFileReader.GetFile(cacheFullPath, source.Url);

            using var xls = stream.OpenWorkbook();
            var worksheets = xls.Worksheets;

            var worksheet = worksheets
                .FirstOrDefault(w => w.Name.Contains(sheetName, StringComparison.InvariantCultureIgnoreCase));

            if (worksheet is null)
            {
                throw new InvalidOperationException("File does not contain terminals list");
            }

            var data = GetData(worksheet, expectedHeaders);
            
            var outputFileName = $"{Path.GetFileNameWithoutExtension(cacheFullPath)}_{sheetName}.json";

            var outputFullPath = Path.Join(outputDirectory, outputFileName);

            AnsiConsole.MarkupLine($"Output file: [deeppink3]{outputFullPath}[/]");

            var mapped = data
                .Select(excelMapper.Map)
                .ToList();

            var content = JsonSerializer.Serialize(mapped);

            await File.WriteAllTextAsync(outputFullPath, content);

            AnsiConsole.MarkupLine($"Json written length: [deeppink3]{mapped.Count}[/]");

            stream.Close();
            return (outputFullPath, content);
        }
        catch (Exception exception)
        {
            AnsiConsole.WriteException(exception);
            return null;
        }
    }
    
    private List<Dictionary<string, string>> GetData(IXLWorksheet worksheet, IEnumerable<string> expectedHeaders)
    {
        var (headers, headerLineNumber) = IdentifyHeader(worksheet, expectedHeaders);

        var data = new List<Dictionary<string, string>>();

        // Loop through each row and create a dictionary for each row
        foreach (var row in worksheet.RowsUsed().Skip(headerLineNumber)) // Skip the header row
        {
            var rowData = new Dictionary<string, string>();
            for (int i = 1; i <= headers.Count; i++)
            {
                rowData[headers[i - 1]] = row.Cell(i).GetString();
            }
            data.Add(rowData);
        }

        return data;
    }

    private (List<string> Header, int HeaderLineNumber) IdentifyHeader(IXLWorksheet worksheet, IEnumerable<string> expectedHeaders)
    {
        // Get the column headers from the first row
        var (row, rowNumber) = worksheet
            .Rows()
            .Where(r => expectedHeaders
                .All(headerText => r
                    .Cells()
                    .Any(c => !c.IsEmpty() && c.GetString().Contains(headerText, StringComparison.InvariantCultureIgnoreCase))))
            .Select(r => (r, r.RowNumber()))
            .FirstOrDefault();

        if (row is null)
        {
            throw new InvalidOperationException("Could not find the header");
        }

        var header = row.Cells()
            .Select(cell => HeaderCleanup().Replace(cell.GetString().Trim(), " "))
            .ToList();

        AnsiConsole.MarkupLine($"Header found at line: [deeppink3]{rowNumber}[/]");

        return (header, rowNumber);
    }

    [GeneratedRegex(@"[\n\r\s]+")]
    private static partial Regex HeaderCleanup();
}