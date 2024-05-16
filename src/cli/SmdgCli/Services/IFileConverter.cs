namespace SmdgCli.Services;

using Schemas.Liners;

public interface IFileConverter
{
    Task<(string File, string Content)?> ExcelToJson<TResult>(
        DataSource source,
        string sheetName,
        IEnumerable<string> expectedHeaders,
        IExcelMapper<TResult> excelMapper,
        string outputDirectory);
}