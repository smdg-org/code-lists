namespace SmdgCli.Test.Utilities;

using ClosedXML.Excel;
using FluentAssertions;
using SmdgCli.Utilities;
using Xunit;

public class CountryCodesTests
{
    [Fact]
    public void FromName_ShouldResolveEveryCountryOfTheV2TemplateDropdown()
    {
        using var workbook = new XLWorkbook("TestData/ApplicationFormV2.xlsx");
        var countries = workbook.Worksheet("Hoja2").Column(1).CellsUsed().Select(c => c.GetString()).ToList();

        countries.Should().HaveCount(249);
        countries.Where(c => CountryCodes.FromName(c) is null).Should().BeEmpty();
        countries.Select(CountryCodes.FromName).Should().OnlyHaveUniqueItems();
    }

    [Theory]
    [InlineData("Germany", "DE")]
    [InlineData(" spain ", "ES")]
    [InlineData("Côte d'Ivoire", "CI")]
    [InlineData("Hong Kong SAR China", "HK")]
    [InlineData("Narnia", null)]
    [InlineData(null, null)]
    public void FromName_ShouldReturnIsoAlpha2Code(string? name, string? expected)
    {
        CountryCodes.FromName(name).Should().Be(expected);
    }
}
