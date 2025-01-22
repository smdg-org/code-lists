namespace SmdgCli.Test.Schemas.Liners.Conversion;

using AutoFixture;
using FluentAssertions;
using SmdgCli.Schemas.Liners.Conversion;
using Xunit;

public class LinerCodeExcelMapperTests
{
    private readonly LinerCodeExcelMapper _mapper = new();
    private readonly Fixture _fixture = new();

    public LinerCodeExcelMapperTests()
    {
        _fixture.Customizations.Add(new DateOnlySpecimenBuilder());
    }

    [Fact]
    public void Map_ValidSource_ShouldReturnExpectedLinerCodeExcel()
    {
        // Arrange
        var source = new Dictionary<string, string>
        {
            ["Code"] = "ABC",
            ["Line"] = "Test Line",
            ["Parent company"] = "Test Parent Company",
            ["NVOCC"] = "X",
            ["VOCC"] = "X",
            ["Last change"] = "2023-01-01",
            ["Valid from"] = "2023-01-01",
            ["Valid until"] = "2023-12-31",
            ["Website"] = "http://example.com",
            ["Address"] = "Test Address",
            ["Remarks"] = "Test Remarks",
            ["Street"] = "Test Street",
            ["No."] = "123",
            ["Building/Suite/Floor"] = "Test Floor",
            ["Zip code"] = "12345",
            ["City"] = "Test City",
            ["State/Region"] = "Test State",
            ["Country"] = "Test Country",
            ["UN Country Code"] = "TC",
            ["UN Location Code"] = "TCL",
            ["Active"] = "active"
        };

        // Act
        var result = _mapper.Map(source);

        // Assert
        result.Code.Should().Be("ABC");
        result.Line.Should().Be("Test Line");
        result.ParentCompany.Should().Be("Test Parent Company");
        result.Nvocc.Should().BeTrue();
        result.Vocc.Should().BeTrue();
        result.LastChange.Should().Be(DateOnly.FromDateTime(DateTime.Parse("2023-01-01")));
        result.ValidFrom.Should().Be(DateOnly.FromDateTime(DateTime.Parse("2023-01-01")));
        result.ValidUntil.Should().Be(DateOnly.FromDateTime(DateTime.Parse("2023-12-31")));
        result.Website.Should().Be("http://example.com");
        result.Address.Should().Be("Test Address");
        result.Remarks.Should().Be("Test Remarks");
        result.Street.Should().Be("Test Street");
        result.StreetNumber.Should().Be("123");
        result.Floor.Should().Be("Test Floor");
        result.ZipCode.Should().Be("12345");
        result.City.Should().Be("Test City");
        result.StateRegion.Should().Be("Test State");
        result.Country.Should().Be("Test Country");
        result.UnCountryCode.Should().Be("TC");
        result.UnLocationCode.Should().Be("TCL");
        result.IsActive.Should().BeTrue();
    }

    [Fact]
    public void ReverseMap_ValidSource_ShouldReturnExpectedDictionary()
    {
        // Arrange
        var source = _fixture.Build<LinerCodeExcel>()
            .With(x => x.Code, "ABC")
            .With(x => x.Line, "Test Line")
            .With(x => x.ParentCompany, "Test Parent Company")
            .With(x => x.Nvocc, true)
            .With(x => x.Vocc, true)
            .With(x => x.LastChange, DateOnly.FromDateTime(DateTime.Parse("2023-01-01")))
            .With(x => x.ValidFrom, DateOnly.FromDateTime(DateTime.Parse("2023-01-01")))
            .With(x => x.ValidUntil, DateOnly.FromDateTime(DateTime.Parse("2023-12-31")))
            .With(x => x.Website, "http://example.com")
            .With(x => x.Address, "Test Address")
            .With(x => x.Remarks, "Test Remarks")
            .With(x => x.Street, "Test Street")
            .With(x => x.StreetNumber, "123")
            .With(x => x.Floor, "Test Floor")
            .With(x => x.ZipCode, "12345")
            .With(x => x.City, "Test City")
            .With(x => x.StateRegion, "Test State")
            .With(x => x.Country, "Test Country")
            .With(x => x.UnCountryCode, "TC")
            .With(x => x.UnLocationCode, "TCL")
            .With(x => x.IsActive, true)
            .Create();

        // Act
        var result = _mapper.ReverseMap(source);

        // Assert
        result["Code"].Should().Be("ABC");
        result["Line"].Should().Be("Test Line");
        result["Parent company"].Should().Be("Test Parent Company");
        result["NVOCC"].Should().Be("X");
        result["VOCC"].Should().Be("X");
        result["Last change"].Should().Be("2023-01-01");
        result["Valid from"].Should().Be("2023-01-01");
        result["Valid until"].Should().Be("2023-12-31");
        result["Website"].Should().Be("http://example.com");
        result["Address"].Should().Be("Test Address");
        result["Remarks"].Should().Be("Test Remarks");
        result["Street"].Should().Be("Test Street");
        result["No."].Should().Be("123");
        result["Building/Suite/Floor"].Should().Be("Test Floor");
        result["Zip code"].Should().Be("12345");
        result["City"].Should().Be("Test City");
        result["State/Region"].Should().Be("Test State");
        result["Country"].Should().Be("Test Country");
        result["UN Country Code"].Should().Be("TC");
        result["UN Location Code"].Should().Be("TCL");
        result["Active"].Should().Be("active");
    }
}