namespace SmdgCli.Services;

public interface IExcelFile
{
    List<Dictionary<string, string>>? Read(
        string fileName,
        string sheetName,
        IEnumerable<string> expectedHeaders,
        string dataDirectory);

    CodeDictionaries? ReadMultipleSheets(
        string fileName,
        string codesSheetName,
        string changesSheetName,
        IEnumerable<string> codesExpectedHeaders,
        IEnumerable<string> changesExpectedHeaders,
        string dataDirectory);

    void Write(
        CodeDictionaries codeDictionaries,
        IEnumerable<string> codesExpectedHeaders,
        IEnumerable<string> changesExpectedHeaders,
        string templateFilePath,
        string outputFilePath,
        string codesSheetName = "Codes",
        string changesSheetName = "Change Log");
}