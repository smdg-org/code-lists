namespace SmdgCli.Services;

using OpenXML;
using Spectre.Console;
using Utilities;

public class ExcelFile : IExcelFile
{
    public List<Dictionary<string, string>>? Read(
        string fileName,
        string sheetName,
        IEnumerable<string> expectedHeaders,
        string dataDirectory)
    {
        try
        {
            var filePath = Path.Combine(dataDirectory, fileName);

            AnsiConsole.MarkupLine($"Converting source: [deeppink3]{filePath}[/]");
            
            var stream = GetStream(filePath);

            using var xls = stream.OpenWorkbook();
            var worksheets = xls.Worksheets;

            var worksheet = worksheets
                .FirstOrDefault(w => w.Name.Contains(sheetName, StringComparison.InvariantCultureIgnoreCase));
            if (worksheet is null)
            {
                throw new InvalidOperationException("File does not contain the required sheet");
            }

            var (headers, headerLineNumber) = worksheet.IdentifyHeader(expectedHeaders);
            var data = worksheet.GetData(headers, headerLineNumber);

            stream.Close();
            return data;
        }
        catch (Exception exception)
        {
            AnsiConsole.WriteException(exception);
            return null;
        }
    }

    public CodeDictionaries? ReadMultipleSheets(
        string fileName,
        string codesSheetName,
        string changesSheetName,
        IEnumerable<string> codesExpectedHeaders,
        IEnumerable<string> changesExpectedHeaders,
        string dataDirectory)
    {
        try
        {
            var filePath = Path.Combine(dataDirectory, fileName);

            AnsiConsole.MarkupLine($"Converting source: [deeppink3]{filePath}[/]");

            var stream = GetStream(filePath);

            using var xls = stream.OpenWorkbook();
            var worksheets = xls.Worksheets;

            var codesWorksheet = worksheets
                .FirstOrDefault(w => w.Name.Contains(codesSheetName, StringComparison.InvariantCultureIgnoreCase));
            if (codesWorksheet is null)
            {
                throw new InvalidOperationException("File does not contain codes list");
            }

            var (codesHeaders, codesHeaderLineNumber) = codesWorksheet.IdentifyHeader(codesExpectedHeaders);
            var codes = codesWorksheet.GetData(codesHeaders, codesHeaderLineNumber);
            
            var changesWorksheet = worksheets
                .FirstOrDefault(w => w.Name.Contains(changesSheetName, StringComparison.InvariantCultureIgnoreCase));
            if (changesWorksheet is null)
            {
                throw new InvalidOperationException("File does not contain change log");
            }

            var (changeHeaders, changeHeaderLineNumber) = changesWorksheet.IdentifyHeader(changesExpectedHeaders);
            var changes = changesWorksheet.GetData(changeHeaders, changeHeaderLineNumber);

            stream.Close();
            return new CodeDictionaries
            {
                Codes = codes,
                Changes = changes
            };
        }
        catch (Exception exception)
        {
            AnsiConsole.WriteException(exception);
            return null;
        }
    }

    public void Write(
        CodeDictionaries codeDictionaries,
        IEnumerable<string> codesExpectedHeaders,
        IEnumerable<string> changesExpectedHeaders,
        string templateFilePath,
        string outputFilePath,
        string codesSheetName = "Codes",
        string changesSheetName = "Change Log")
    {
        var stream = GetStream(templateFilePath);

        using var xls = stream.OpenWorkbook();
        var codesWorksheet = xls.Worksheets.FirstOrDefault(s => s.Name == codesSheetName);
        if (codesWorksheet is null)
        {
            throw new InvalidOperationException("Template file does not contain Codes sheet");
        }
        
        var changesWorksheet = xls.Worksheets.FirstOrDefault(s => s.Name == changesSheetName);
        if (changesWorksheet is null)
        {
            throw new InvalidOperationException("Template file does not contain sheet for changes");
        }

        var codesHeader = codesWorksheet.IdentifyHeader(codesExpectedHeaders);
        var changesHeader = changesWorksheet.IdentifyHeader(changesExpectedHeaders);

        codesWorksheet.PutData(codesHeader.Header, codesHeader.HeaderLineNumber, codeDictionaries.Codes);
        changesWorksheet.PutData(changesHeader.Header, changesHeader.HeaderLineNumber, codeDictionaries.Changes);

        xls.SaveAs(outputFilePath);
    }

    private static FileStream GetStream(string filePath)
    {
        if (!File.Exists(filePath))
        {
            AnsiConsole.MarkupLine($"[red]Reading the local file failed: {filePath}[/]");
            throw new InvalidDataException();
        }

        AnsiConsole.MarkupLine($"Reading the xlsx file from: [deeppink3]{filePath}[/]");
        return File.Open(filePath, FileMode.Open, FileAccess.ReadWrite);
    }
}