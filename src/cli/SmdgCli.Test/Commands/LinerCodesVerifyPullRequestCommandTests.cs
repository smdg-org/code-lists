namespace SmdgCli.Test.Commands;

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
using Xunit;

public class LinerCodesVerifyPullRequestCommandTests
{
    private readonly IFileStore _fileStore = Substitute.For<IFileStore>();
    private readonly IGitHubClient _git = Substitute.For<IGitHubClient>();
    private readonly LinerCodesVerifyPullRequestCommand _command;
    private readonly CommandContext _context = new([], Substitute.For<IRemainingArguments>(), "", "");
    private readonly LinerCodesVerifyPullRequestSettings _settings = new()
    {
        PullRequest = 1,
        OutputDirectory = Path.Combine(RepositoryPathUtils.GetRepositoryRoot(), "data", "liner-codes"),
        Repository = "test/repo",
        Token = "test-token"
    };

    public LinerCodesVerifyPullRequestCommandTests()
    {
        var factory = Substitute.For<IGitHubClientFactory>();
        factory.Create("test", "test-token").Returns(_git);
        _command = new LinerCodesVerifyPullRequestCommand(_fileStore, factory);
        _fileStore.TryReadAsync<LinerCodeIndex>("_index", _settings.OutputDirectory)
            .Returns(new LinerCodeIndex([]));
        _fileStore.TryReadAsync<List<LinerCode>>("_combined", _settings.OutputDirectory)
            .Returns(new List<LinerCode>());
    }

    [Theory]
    [InlineData("removed")]
    [InlineData("REMOVED")]
    public async Task RemovedFile_ShouldBeSkipped_AndReportZeroValidatedFiles(string status)
    {
        SetChangedFiles(ChangedFile("npl.json", status));

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(0);
        await _fileStore.DidNotReceive().TryReadAsync<LinerCode>("npl", _settings.OutputDirectory);
        await AssertCommentContains("0 files validated");
        await AssertCommentContains("Deleted liner codes: `npl`");
    }

    [Theory]
    [InlineData("npl.json")]
    [InlineData("NPL.JSON")]
    public async Task RemovedFile_StillInIndex_ShouldFail(string reference)
    {
        SetChangedFiles(ChangedFile("npl.json", "removed"));
        _fileStore.TryReadAsync<LinerCodeIndex>("_index", _settings.OutputDirectory)
            .Returns(new LinerCodeIndex([reference]));

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(1);
        await AssertCommentContains("Deleted code 'npl' is still referenced in _index.json.");
    }

    [Theory]
    [InlineData("npl")]
    [InlineData("NPL")]
    public async Task RemovedCode_StillInCombined_ShouldFail(string reference)
    {
        SetChangedFiles(ChangedFile("npl.json", "removed"));
        _fileStore.TryReadAsync<List<LinerCode>>("_combined", _settings.OutputDirectory)
            .Returns(new List<LinerCode> { ValidCode(reference) });

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(1);
        await AssertCommentContains("Deleted code 'npl' is still referenced in _combined.json.");
    }

    [Theory]
    [InlineData("_index", "_index.json")]
    [InlineData("_combined", "_combined.json")]
    public async Task RemovedCode_WithUnreadableAggregate_ShouldFail(string code, string fileName)
    {
        SetChangedFiles(ChangedFile("npl.json", "removed"));
        if (code == "_index")
        {
            _fileStore.TryReadAsync<LinerCodeIndex>(code, _settings.OutputDirectory)
                .Returns((LinerCodeIndex?)null);
        }
        else
        {
            _fileStore.TryReadAsync<List<LinerCode>>(code, _settings.OutputDirectory)
                .Returns((List<LinerCode>?)null);
        }

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(1);
        await AssertCommentContains($"Cannot verify deleted code 'npl': {fileName} is missing or invalid.");
    }

    [Theory]
    [InlineData(false, 0)]
    [InlineData(true, 1)]
    public async Task RenamedFile_ShouldValidateNewName(bool invalid, int expectedExitCode)
    {
        SetChangedFiles(ChangedFile("mrt.json", "renamed", "mtr.json"));
        var code = ValidCode("MRT");
        if (invalid)
        {
            code.LinerName = "";
        }
        _fileStore.TryReadAsync<LinerCode>("mrt", _settings.OutputDirectory).Returns(code);
        _fileStore.TryReadAsync<LinerCodeIndex>("_index", _settings.OutputDirectory)
            .Returns(new LinerCodeIndex(["mrt.json"]));
        _fileStore.TryReadAsync<List<LinerCode>>("_combined", _settings.OutputDirectory)
            .Returns(new List<LinerCode> { code });

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(expectedExitCode);
        await _fileStore.Received(1).TryReadAsync<LinerCode>("mrt", _settings.OutputDirectory);
        await _fileStore.DidNotReceive().TryReadAsync<LinerCode>("mtr", _settings.OutputDirectory);
    }

    [Fact]
    public async Task RenameReportedAsDeleteAndAdd_ShouldPass_WhenOldCodeIsAbsent()
    {
        SetChangedFiles(ChangedFile("mtr.json", "removed"), ChangedFile("mrt.json", "added"));
        var code = ValidCode("MRT");
        _fileStore.TryReadAsync<LinerCode>("mrt", _settings.OutputDirectory).Returns(code);
        _fileStore.TryReadAsync<LinerCodeIndex>("_index", _settings.OutputDirectory)
            .Returns(new LinerCodeIndex(["mrt.json"]));
        _fileStore.TryReadAsync<List<LinerCode>>("_combined", _settings.OutputDirectory)
            .Returns(new List<LinerCode> { code });

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(0);
        await _fileStore.DidNotReceive().TryReadAsync<LinerCode>("mtr", _settings.OutputDirectory);
        await AssertCommentContains("1 files validated");
        await AssertCommentContains("Deleted liner codes: `mtr`");
    }

    [Theory]
    [InlineData(false, 0)]
    [InlineData(true, 1)]
    public async Task ModifiedFile_ShouldRespectExistingValidation(bool invalid, int expectedExitCode)
    {
        SetChangedFiles(ChangedFile("npl.json", "modified"));
        var code = ValidCode("NPL");
        if (invalid)
        {
            code.LinerName = "";
        }
        _fileStore.TryReadAsync<LinerCode>("npl", _settings.OutputDirectory).Returns(code);

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(expectedExitCode);
        await AssertCommentContains(invalid ? "Liner Name is required" : "1 files validated");
    }

    [Fact]
    public async Task MissingChangedFile_ShouldPostNamedFailure_AndContinueValidation()
    {
        SetChangedFiles(ChangedFile("missing.json", "modified"), ChangedFile("mrt.json", "modified"));
        _fileStore.TryReadAsync<LinerCode>("mrt", _settings.OutputDirectory).Returns(ValidCode("MRT"));

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(1);
        await AssertCommentContains("Changed file 'missing.json' is missing or is not a valid liner code file.");
        await _fileStore.Received(1).TryReadAsync<LinerCode>("mrt", _settings.OutputDirectory);
    }

    [Fact]
    public async Task RemovedNonCodeFiles_ShouldNotTriggerDeletionChecks()
    {
        SetChangedFiles(
            ChangedFile("notes.txt", "removed"),
            ChangedFile("_INDEX.JSON", "removed"),
            ChangedFile("_COMBINED.JSON", "removed"),
            ChangedFile("npl.json", "removed", directory: "other"));

        var result = await _command.ExecuteAsync(_context, _settings);

        result.Should().Be(0);
        await _fileStore.DidNotReceive().TryReadAsync<LinerCodeIndex>("_index", _settings.OutputDirectory);
        await _fileStore.DidNotReceive().TryReadAsync<List<LinerCode>>("_combined", _settings.OutputDirectory);
    }

    private void SetChangedFiles(params PullRequestFile[] files) =>
        _git.PullRequest.Files("test", "repo", 1).Returns(files);

    private Task AssertCommentContains(string text) =>
        _git.Issue.Comment.Received().Create("test", "repo", 1,
            Arg.Is<string>(body => body.StartsWith(GitHubComments.PullRequestValidationMarker) && body.Contains(text)));

    private static PullRequestFile ChangedFile(
        string name, string status, string? previousName = null, string directory = "data/liner-codes") =>
        new SimpleJsonSerializer().Deserialize<PullRequestFile>(JsonSerializer.Serialize(new
        {
            filename = $"{directory}/{name}",
            status,
            previous_filename = previousName is null ? null : $"{directory}/{previousName}"
        }));

    private static LinerCode ValidCode(string code) => new()
    {
        IsActive = true,
        CodeStatus = default,
        LinerCodeVersion = "V1",
        LinerSmdgCode = code,
        LinerName = "Test liner",
        UnstructuredAddress = "",
        AddressLocation = new AddressLocation(),
        Website = "",
        Remarks = "",
        ValidFrom = new DateOnly(2025, 1, 1),
        ChangeLogs = []
    };
}
