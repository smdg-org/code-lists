namespace SmdgCli.Test.Services;

using AutoFixture;
using FluentAssertions;
using SmdgCli.Services;
using Xunit;

public class ExcelFileTests
{
    private readonly IFixture _fixture = new Fixture();
    private readonly ExcelFile _excelFile = new();

    [Fact]
    public void Read_ShouldReturnData_WhenFileIsValid()
    {
        // Arrange
        var fileName = "SampleExcel.xlsx";
        var sheetName = "Sheet1";
        var expectedHeaders = new List<string> { "Header1", "Header2", "Header3" };
        var dataDirectory = "TestData";

        // Act
        var result = _excelFile.Read(fileName, sheetName, expectedHeaders, dataDirectory);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<List<Dictionary<string, string>>>();
    }

    [Fact]
    public void Read_ShouldReturnNull_WhenFileIsInvalid()
    {
        // Arrange
        var fileName = "invalid.xlsx";
        var sheetName = "Sheet1";
        var expectedHeaders = new List<string> { "Header1", "Header2", "Header3" };
        var dataDirectory = "TestData";

        // Act
        var result = _excelFile.Read(fileName, sheetName, expectedHeaders, dataDirectory);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void ReadMultipleSheets_ShouldReturnCodeDictionaries_WhenFileIsValid()
    {
        // Arrange
        var fileName = "SampleExcelMultiple.xlsx";
        var codesSheetName = "Codes";
        var changesSheetName = "Changes";
        var codesExpectedHeaders = new List<string> { "Code", "Description" };
        var changesExpectedHeaders = new List<string> { "Code", "Change", "Date" };
        var dataDirectory = "TestData";

        // Act
        var result = _excelFile.ReadMultipleSheets(fileName, codesSheetName, changesSheetName, codesExpectedHeaders, changesExpectedHeaders, dataDirectory);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<CodeDictionaries>();
    }

    [Fact]
    public void ReadMultipleSheets_ShouldReturnNull_WhenFileIsInvalid()
    {
        // Arrange
        var fileName = "invalid.xlsx";
        var codesSheetName = "Codes";
        var changesSheetName = "Changes";
        var codesExpectedHeaders = new List<string> { "Code", "Description" };
        var changesExpectedHeaders = new List<string> { "Change", "Date" };
        var dataDirectory = "data";

        // Act
        var result = _excelFile.ReadMultipleSheets(fileName, codesSheetName, changesSheetName, codesExpectedHeaders, changesExpectedHeaders, dataDirectory);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void Write_ShouldNotThrowException_WhenDataIsValid()
    {
        // Arrange
        var codeDictionaries = _fixture.Create<CodeDictionaries>();
        var codesExpectedHeaders = new List<string> { "Code", "Description" };
        var changesExpectedHeaders = new List<string> { "Code", "Change", "Date" };
        var templateFilePath = "TestData/SampleExcelTemplate.xlsx";
        var outputFilePath = $"{_fixture.Create<string>()}.xlsx";

        // Act
        Action act = () => _excelFile.Write(
            codeDictionaries,
            codesExpectedHeaders,
            changesExpectedHeaders,
            templateFilePath,
            outputFilePath,
            "Codes",
            "Changes");

        // Assert
        act.Should().NotThrow();
        
        // Clean up
        File.Delete(outputFilePath);
    }
}