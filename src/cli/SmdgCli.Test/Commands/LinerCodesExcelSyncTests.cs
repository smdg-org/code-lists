namespace SmdgCli.Test.Commands;

using AutoFixture;
using ClosedXML.Excel;
using FluentAssertions;
using NSubstitute;
using Octokit;
using Octokit.Internal;
using SmdgCli.Commands;
using SmdgCli.Schemas.Liners;
using SmdgCli.Schemas.Liners.Conversion;
using SmdgCli.Services;
using SmdgCli.Utilities;
using Spectre.Console.Cli;
using System.Text.Json;
using Xunit;

public class LinerCodesExcelSyncTests : IDisposable
{
    private readonly string _outputDirectory = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
    private readonly FileStore _fileStore = new();
    private readonly Fixture _fixture = new();
    private readonly CommandContext _context = new([], Substitute.For<IRemainingArguments>(), "", "");

    public LinerCodesExcelSyncTests()
    {
        _fixture.Customizations.Add(new DateOnlySpecimenBuilder());
        CacheDirectory.Ensure(_outputDirectory);
    }

    public void Dispose() => Directory.Delete(_outputDirectory, true);

    [Theory]
    [InlineData("Add")]
    [InlineData("Update")]
    public async Task ExcelForm_ShouldKeepCombinedInSync_WhenAddingOrUpdating(string changeType)
    {
        var existing = _fixture.Build<LinerCode>()
            .With(x => x.LinerSmdgCode, "ZZZ")
            .With(x => x.LinerCodeVersion, "V1")
            .Create();
        await _fileStore.WriteAllAsync([existing], _outputDirectory, x => x.LinerSmdgCode);
        var code = changeType == "Add" ? "AAA" : existing.LinerSmdgCode;
        var formData = CodeRow(code, "Updated Excel liner");
        formData["Applicant/Contact"] = "Test requester";
        var fileName = "form.xlsx";
        using (var workbook = new XLWorkbook())
        {
            AddSheet(workbook, "Application form liner codes", [formData]);
            workbook.SaveAs(Path.Combine(_outputDirectory, CacheDirectory.Name, fileName));
        }

        var issue = new SimpleJsonSerializer().Deserialize<Issue>(JsonSerializer.Serialize(new
        {
            state = "open",
            labels = new[] { new { name = "data" }, new { name = "liner-code" } },
            body = $"### Change Type\n{changeType}\n### Liner Code\n{code}\n### Requester\nTest requester"
        }));
        var git = Substitute.For<IGitHubClient>();
        git.Issue.Get("test", "repo", 1).Returns(issue);
        var factory = Substitute.For<IGitHubClientFactory>();
        factory.Create("test", "test-token").Returns(git);
        var command = new LinerCodesConvertFormExcelCommand(
            factory, new LinerCodeFormMapper(), new ExcelFile(), _fileStore);
        var settings = new LinerCodesConvertFormExcelSettings
        {
            IssueNumber = 1,
            LocalFileName = fileName,
            OutputDirectory = _outputDirectory,
            Repository = "test/repo",
            Token = "test-token"
        };

        var result = await command.ExecuteAsync(_context, settings);

        result.Should().Be(0);
        await AssertCombinedMatchesIndividuals(changeType == "Add" ? 2 : 1);
        var combined = (await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory)).ToList();
        combined.Single(x => x.LinerSmdgCode == code).LinerName.Should().Be("Updated Excel liner");
        combined.Single(x => x.LinerSmdgCode == code).ChangeLogs.Should().NotBeEmpty();
    }

    [Fact]
    public async Task BulkExcel_ShouldWriteCombinedInCanonicalOrder_WithChangeHistory()
    {
        var fileName = "bulk.xlsx";
        using (var workbook = new XLWorkbook())
        {
            AddSheet(workbook, "Codes", [CodeRow("ZZZ", "Last liner"), CodeRow("AAA", "First liner")]);
            AddSheet(workbook, "Change Log",
            [
                new Dictionary<string, string>
                {
                    ["Last update"] = "2025-01-01",
                    ["Liner Code"] = "ZZZ",
                    ["Action"] = "added",
                    ["Company"] = "Test company",
                    ["Reason for change"] = "Test request",
                    ["Comments"] = "requested by Test requester"
                }
            ]);
            workbook.SaveAs(Path.Combine(_outputDirectory, CacheDirectory.Name, fileName));
        }
        var command = new LinerCodesConvertBulkCommand(
            new ExcelFile(), new LinerCodeExcelMapper(), new LinerCodeChangeExcelMapper(),
            new LinerCodeMapper(), _fileStore);
        var settings = new LinerCodesConvertBulkSettings
        {
            FileName = fileName,
            OutputDirectory = _outputDirectory,
            Repository = "test/repo",
            Token = "test-token"
        };

        var result = await command.ExecuteAsync(_context, settings);

        result.Should().Be(0);
        await AssertCombinedMatchesIndividuals(2);
        var combined = (await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory)).ToList();
        combined.Select(x => x.LinerSmdgCode).Should().Equal("AAA", "ZZZ");
        combined.Single(x => x.LinerSmdgCode == "ZZZ").ChangeLogs
            .Should().ContainSingle(x => x.Reason == "Test request");
        var combinedPath = Path.Combine(_outputDirectory, FileStore.CombinedFileName);
        var beforeRebuild = await File.ReadAllTextAsync(combinedPath);
        await _fileStore.RebuildCombined<LinerCode>(_outputDirectory, default);
        (await File.ReadAllTextAsync(combinedPath)).Should().Be(beforeRebuild);
    }

    private async Task AssertCombinedMatchesIndividuals(int expectedCount)
    {
        var combined = (await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory)).ToList();
        var individual = await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory, false);
        combined.Should().HaveCount(expectedCount);
        combined.Should().BeEquivalentTo(individual, options => options.WithStrictOrdering());
        combined.Select(x => x.LinerSmdgCode).Should().OnlyHaveUniqueItems();
    }

    private static Dictionary<string, string> CodeRow(string code, string name) => new()
    {
        ["Code"] = code,
        ["Line"] = name,
        ["Parent company"] = "Test company",
        ["NVOCC"] = "",
        ["VOCC"] = "X",
        ["Valid from"] = "2025-01-01",
        ["Valid until"] = "",
        ["Website"] = "https://example.com",
        ["Address"] = "Test address",
        ["Remarks"] = ""
    };

    private static void AddSheet(XLWorkbook workbook, string name, List<Dictionary<string, string>> rows)
    {
        var worksheet = workbook.AddWorksheet(name);
        var headers = rows[0].Keys.ToArray();
        for (var column = 0; column < headers.Length; column++)
        {
            worksheet.Cell(1, column + 1).Value = headers[column];
            for (var row = 0; row < rows.Count; row++)
            {
                worksheet.Cell(row + 2, column + 1).Value = rows[row][headers[column]];
            }
        }
    }
}
