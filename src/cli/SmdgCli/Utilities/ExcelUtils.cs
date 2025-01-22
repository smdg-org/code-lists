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
            for (var i = 1; i <= headers.Count; i++)
            {
                rowData[headers[i - 1]] = currentRow.Cell(i).GetString();
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
            foreach (var header in headers)
            {
                var columnIndex = headers.IndexOf(header) + 1;

                if (!dataRow.TryGetValue(header, out var value))
                {
                    currentRow.Cell(columnIndex).Value = string.Empty;
                    continue;
                }

                currentRow.Cell(columnIndex).Value = value;
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

        var header = row.Cells()
            .Select(cell => HeaderCleanup().Replace(cell.GetString().Trim(), " "))
            .ToList();

        AnsiConsole.MarkupLine($"Header found at line: [deeppink3]{rowNumber}[/]");

        return (header, rowNumber);
    }

    [GeneratedRegex(@"[\n\r\s]+")]
    private static partial Regex HeaderCleanup();
}