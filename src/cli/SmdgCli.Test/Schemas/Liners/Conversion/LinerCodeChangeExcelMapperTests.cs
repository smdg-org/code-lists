namespace SmdgCli.Test.Schemas.Liners.Conversion;

using AutoFixture;
using FluentAssertions;
using SmdgCli.Schemas.Liners.Conversion;

public class LinerCodeChangeExcelMapperTests
{
    private readonly LinerCodeChangeExcelMapper _mapper = new();
    private readonly Fixture _fixture = new();

    [Fact]
    public void Map_ValidSource_ShouldReturnExpectedLinerCodeChangeExcel()
    {
        // Arrange
        var source = new Dictionary<string, string>
        {
            ["Last update"] = "2023-01-01",
            ["Liner Code"] = "LC123",
            ["Action"] = "Update",
            ["Company"] = "Test Company",
            ["Reason for change"] = "Test Reason",
            ["Comments"] = "Test Comments"
        };

        // Act
        var result = _mapper.Map(source);

        // Assert
        result.LastUpdate.Should().Be(DateOnly.FromDateTime(DateTime.Parse("2023-01-01")));
        result.LinerCode.Should().Be("LC123");
        result.Action.Should().Be("Update");
        result.Company.Should().Be("Test Company");
        result.Reason.Should().Be("Test Reason");
        result.Comments.Should().Be("Test Comments");
    }

    [Fact]
    public void ReverseMap_ValidSource_ShouldReturnExpectedDictionary()
    {
        // Arrange
        var source = _fixture
            .Build<LinerCodeChangeExcel>()
            .With(x => x.LastUpdate, DateOnly.FromDateTime(DateTime.Parse("2023-01-01")))
            .With(x => x.LinerCode, "LC123")
            .With(x => x.Action, "Update")
            .With(x => x.Company, "Test Company")
            .With(x => x.Reason, "Test Reason")
            .With(x => x.Comments, "Test Comments")
            .Create();

        // Act
        var result = _mapper.ReverseMap(source);

        // Assert
        result["Last update"].Should().Be("2023-01-01");
        result["Liner Code"].Should().Be("LC123");
        result["Action"].Should().Be("Update");
        result["Company"].Should().Be("Test Company");
        result["Reason for change"].Should().Be("Test Reason");
        result["Comments"].Should().Be("Test Comments");
    }
}