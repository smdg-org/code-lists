namespace SmdgCli.Services;

public interface IFileConverter
{
    Task<(string File, string Content)?> ExcelToJson<TResult>(
        DataSource source,
        string sheetName,
        IEnumerable<string> expectedHeaders,
        IExcelMapper<TResult> excelMapper,
        string dataDirectory);
}