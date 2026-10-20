namespace SmdgCli.Test.Commands;

using AutoFixture;
using FluentAssertions;
using NSubstitute;
using Octokit;
using Octokit.Internal;
using SmdgCli.Commands;
using SmdgCli.Schemas.Liners;
using SmdgCli.Services;
using SmdgCli.Utilities;
using Spectre.Console.Cli;
using System.Text.Json;

public class LinerCodesVerifyPullRequestCommandTests
{
    private readonly IFileStore _fileStore = Substitute.For<IFileStore>();
    private readonly IGitHubClient _git = Substitute.For<IGitHubClient>();
    private readonly IGitHubClientFactory _factory = Substitute.For<IGitHubClientFactory>();
    private readonly LinerCodesVerifyPullRequestSettings _settings = new()
    {
        Repository = "test/repo",
        Token = "test-token",
        PullRequest = 209,
        OutputDirectory = Path.Combine(RepositoryPathUtils.GetRepositoryRoot(), "data", "liner-codes")
    };

    public LinerCodesVerifyPullRequestCommandTests()
    {
        _factory.Create("test", "test-token").Returns(_git);
        _git.Issue.Comment.GetAllForIssue("test", "repo", 209).Returns(Array.Empty<IssueComment>());
    }

    [Theory]
    [InlineData("added")]
    [InlineData("modified")]
    [InlineData("renamed")]
    public async Task ExecuteAsync_RemovedRecord_ShouldSkipItAndValidateRemainingChanges(string status)
    {
        _git.PullRequest.Files("test", "repo", 209).Returns(new[]
        {
            ChangedFile("npl", "removed"),
            ChangedFile("aaa", status),
            ChangedFile("_index", "modified"),
            ChangedFile("_combined", "modified")
        });
        var fixture = new Fixture();
        fixture.Customizations.Add(new DateOnlySpecimenBuilder());
        var liner = fixture.Build<LinerCode>()
            .With(x => x.LinerSmdgCode, "AAA")
            .With(x => x.LinerCodeVersion, "V1")
            .Create();
        _fileStore.TryReadAsync<LinerCode>("aaa", _settings.OutputDirectory).Returns(liner);
        _fileStore.TryReadAsync<LinerCodeIndex>("_index", _settings.OutputDirectory)
            .Returns(new LinerCodeIndex(["aaa.json"]));
        _fileStore.TryReadAsync<List<LinerCode>>("_combined", _settings.OutputDirectory)
            .Returns(new List<LinerCode> { liner });

        var result = await ExecuteAsync();

        result.Should().Be(0);
        await _fileStore.DidNotReceive().TryReadAsync<LinerCode>("npl", _settings.OutputDirectory);
        await _fileStore.Received(1).TryReadAsync<LinerCode>("aaa", _settings.OutputDirectory);
        await _fileStore.Received(1).TryReadAsync<LinerCodeIndex>("_index", _settings.OutputDirectory);
        await _fileStore.Received(1).TryReadAsync<List<LinerCode>>("_combined", _settings.OutputDirectory);
    }

    [Theory]
    [InlineData("aaa", "added")]
    [InlineData("aaa", "modified")]
    [InlineData("aaa", "renamed")]
    [InlineData("_index", "removed")]
    [InlineData("_combined", "removed")]
    public async Task ExecuteAsync_MissingRequiredFile_ShouldStillFail(string code, string status)
    {
        _git.PullRequest.Files("test", "repo", 209).Returns(new[]
        {
            ChangedFile("npl", "removed"),
            ChangedFile(code, status)
        });

        var result = await ExecuteAsync();

        result.Should().Be(1);
        await _fileStore.DidNotReceive().TryReadAsync<LinerCode>("npl", _settings.OutputDirectory);
    }

    private Task<int> ExecuteAsync() =>
        new LinerCodesVerifyPullRequestCommand(_fileStore, _factory).ExecuteAsync(
            new CommandContext([], Substitute.For<IRemainingArguments>(), "", ""), _settings);

    private static PullRequestFile ChangedFile(string code, string status) =>
        new SimpleJsonSerializer().Deserialize<PullRequestFile>(JsonSerializer.Serialize(new
        {
            filename = $"data/liner-codes/{code}.json",
            status
        }));
}
