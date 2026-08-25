namespace SmdgCli.Utilities;

using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Spectre.Console;

public static partial class ExcelUtils
{
    public static List<Dictionary<string, string>> GetData(this IXLWorksheet worksheet, List<string> headers, int headerRowNumber)
    {
        var data = new List<Dictionary<string, string>>();
    
        for(var rowNumber = headerRowNumber + 1; rowNumber <= worksheet.LastRowUsed().RowNumber(); rowNumber++)
        {
            var currentRow = worksheet.Row(rowNumber);
            if (!currentRow.CellsUsed().Any())
            {
                continue;
            }
            var rowData = new Dictionary<string, string>();
            for (var columnNumber = 1; columnNumber <= headers.Count; columnNumber++)
            {
                var header = headers[columnNumber - 1];
                if (string.IsNullOrEmpty(header))
                {
                    // Column without a header, there is no name to store its value under.
                    continue;
                }

                rowData[header] = currentRow.Cell(columnNumber).GetString();
            }
            data.Add(rowData);
        }

        return data;
    }

    public static void PutData(this IXLWorksheet worksheet, List<string> headers, int headerRowNumber, List<Dictionary<string, string>> data)
    {
        var firstEmptyRow = headerRowNumber + 1;
        
        // Write data to the worksheet
        foreach (var dataRow in data)
        {
            var currentRow = worksheet.Row(firstEmptyRow++);
            for (var columnNumber = 1; columnNumber <= headers.Count; columnNumber++)
            {
                var header = headers[columnNumber - 1];
                if (string.IsNullOrEmpty(header))
                {
                    // Column without a header, leave whatever the template puts there untouched.
                    continue;
                }

                if (!dataRow.TryGetValue(header, out var value))
                {
                    currentRow.Cell(columnNumber).Value = string.Empty;
                    continue;
                }

                currentRow.Cell(columnNumber).Value = value;
            }
        }
    }
    
    public static (List<string> Header, int HeaderLineNumber) IdentifyHeader(this IXLWorksheet worksheet, IEnumerable<string> expectedHeaders)
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

        // The header is addressed by position later on, so every column up to the last one
        // has to be represented, including the ones with an empty header cell. Reading only
        // the used cells would shift all following columns and move values into the wrong field.
        var lastColumnNumber = row.LastCellUsed()?.Address.ColumnNumber ?? 0;

        var header = Enumerable
            .Range(1, lastColumnNumber)
            .Select(columnNumber => HeaderCleanup().Replace(row.Cell(columnNumber).GetString().Trim(), " "))
            .ToList();

        AnsiConsole.MarkupLine($"Header found at line: [deeppink3]{rowNumber}[/]");

        return (header, rowNumber);
    }

    [GeneratedRegex(@"[\n\r\s]+")]
    private static partial Regex HeaderCleanup();
}