namespace SmdgCli.Test.Utilities;

using FluentAssertions;
using SmdgCli.Utilities;
using Xunit;

public class RepositoryPathUtilsTests
{
    [Theory]
    [InlineData("data/liner-codes")]
    [InlineData("./data/liner-codes")]
    [InlineData("data/liner-codes/")]
    public void NormalizeRepositoryRelativePath_ShouldNormalizeRelativePathVariants(string path)
    {
        RepositoryPathUtils.NormalizeRepositoryRelativePath(path, Directory.GetCurrentDirectory())
            .Should()
            .Be("data/liner-codes");
    }

    [Fact]
    public void NormalizeRepositoryRelativePath_ShouldNormalizeAbsolutePath()
    {
        var repositoryRoot = Directory.GetCurrentDirectory();
        var path = Path.Combine(repositoryRoot, "data", "liner-codes");

        RepositoryPathUtils.NormalizeRepositoryRelativePath(path, repositoryRoot)
            .Should()
            .Be("data/liner-codes");
    }
}
