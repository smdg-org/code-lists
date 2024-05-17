namespace SmdgCli.Test;

using FluentAssertions;
using Schemas.Liners;

public class LinerCodeMapperTest
{
    [Theory]
    [InlineData("requested by Some Company, other comments", "Some Company")]
    [InlineData("requested by Some Company (Code)", "Some Company")]
    [InlineData("requested by Company123", "Company123")]
    [InlineData("requested by A.A. Company", "A.A. Company")]
    [InlineData("requested by Hyphenated-Name LLC, other comments", "Hyphenated-Name LLC")]
    [InlineData("some random text", null)]
    public void FindRequester_ReturnsRequester(string comment, string? expected)
    {
        // Act
        var actual = LinerCodeMapper.FindRequester(comment);

        // Assert
        actual.Should().Be(expected);
    }
}