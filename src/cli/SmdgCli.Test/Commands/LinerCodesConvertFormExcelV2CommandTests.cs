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

public class LinerCodesConvertFormExcelV2CommandTests : IDisposable
{
    private const string TemplatePath = "TestData/ApplicationFormV2.xlsx";
    private const string FileName = "form-v2.xlsx";

    private readonly string _outputDirectory = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
    private readonly FileStore _fileStore = new();
    private readonly Fixture _fixture = new();
    private readonly CommandContext _context = new([], Substitute.For<IRemainingArguments>(), "", "");
    private readonly IGitHubClient _git = Substitute.For<IGitHubClient>();

    public LinerCodesConvertFormExcelV2CommandTests()
    {
        _fixture.Customizations.Add(new DateOnlySpecimenBuilder());
        CacheDirectory.Ensure(_outputDirectory);
    }

    public void Dispose() => Directory.Delete(_outputDirectory, true);

    [Fact]
    public async Task ExcelV2_ShouldAddLinerCode_FromTemplateCells()
    {
        await WriteExisting("ZZZ");
        // The template ships with the Hapag-Lloyd example in row 10; only the code and country are changed.
        PrepareForm(new() { ["A10"] = "abc", ["N10"] = "Germany", ["R10"] = "Example remark" });

        var result = await Run("Add", "ABC");

        result.Should().Be(0);
        var added = await _fileStore.TryReadAsync<LinerCode>("ABC", _outputDirectory);
        added.Should().NotBeNull();
        added!.LinerSmdgCode.Should().Be("ABC");
        added.LinerName.Should().Be("Hapag-Lloyd");
        added.ParentCompany.Should().BeNull();
        added.CarrierType.Should().Be(CarrierType.NVOCC);
        added.ValidFrom.Should().Be(new DateOnly(2003, 9, 1));
        added.ValidTo.Should().BeNull();
        added.Website.Should().Be("https://www.hapag-lloyd.com/");
        added.Remarks.Should().Be("Example remark");
        added.UnstructuredAddress.Should().Be("Ballindamm 25, 20095 Hamburg, Hamburg, Germany");
        added.AddressLocation.UnCountryCode.Should().Be("DE");
        added.AddressLocation.UnLocode.Should().Be("HAM");
        added.AddressLocation.Address.Should().BeEquivalentTo(new Address
        {
            Street = "Ballindamm",
            StreetNumber = "25",
            Floor = null,
            PostCode = "20095",
            City = "Hamburg",
            State = "Hamburg",
            Country = "Germany",
        });
        added.ChangeLogs.Should().ContainSingle(x => x.ActionCode == ActionCodeEnum.Added && x.UpdateRequestedBy == "Test requester");
        await AssertCombinedMatchesIndividuals(2);
    }

    [Fact]
    public async Task ExcelV2_ShouldUpdateLinerCode_AndKeepCombinedInSync()
    {
        var existing = await WriteExisting("HLC");
        PrepareForm(new() { ["B10"] = "Hapag-Lloyd AG", ["N10"] = "Germany", ["O10"] = "de ham", ["J10"] = "3rd floor" });

        var result = await Run("Update", "HLC");

        result.Should().Be(0);
        var updated = await _fileStore.TryReadAsync<LinerCode>("HLC", _outputDirectory);
        updated!.LinerName.Should().Be("Hapag-Lloyd AG");
        updated.LinerCodeVersion.Should().Be("V2");
        updated.Remarks.Should().Be(existing.Remarks);
        updated.UnstructuredAddress.Should().Be("Ballindamm 25, 3rd floor, 20095 Hamburg, Hamburg, Germany");
        updated.AddressLocation.UnCountryCode.Should().Be("DE");
        updated.AddressLocation.UnLocode.Should().Be("HAM");
        updated.AddressLocation.Address!.Floor.Should().Be("3rd floor");
        updated.ChangeLogs.Should().HaveCount(existing.ChangeLogs.Count + 1);
        await AssertCombinedMatchesIndividuals(1);
    }

    [Fact]
    public async Task ExcelV2_ShouldReadDates_WhenTypedAsIsoText()
    {
        await WriteExisting("ZZZ");
        PrepareForm(new() { ["A10"] = "ABC", ["N10"] = "Germany", ["E10"] = "2026-03-15", ["F10"] = "2027-01-31" });

        var result = await Run("Add", "ABC");

        result.Should().Be(0);
        var added = await _fileStore.TryReadAsync<LinerCode>("ABC", _outputDirectory);
        added!.ValidFrom.Should().Be(new DateOnly(2026, 3, 15));
        added.ValidTo.Should().Be(new DateOnly(2027, 1, 31));
    }

    [Theory]
    [InlineData("15.03.2026")]
    [InlineData("03/15/2026")]
    [InlineData("2026-3-15")]
    [InlineData("46096")]
    public async Task ExcelV2_ShouldRejectDates_WhenNotIso(string validFrom)
    {
        await WriteExisting("ZZZ");
        PrepareForm(new() { ["A10"] = "ABC", ["N10"] = "Germany", ["E10"] = validFrom });

        var result = await Run("Add", "ABC");

        result.Should().Be(1);
        await _git.Issue.Comment.Received(1).Create("test", "repo", 1, Arg.Is<string>(comment =>
            comment.Contains($"Valid from '{validFrom}' is not a valid date. Please use the format YYYY-MM-DD.")));
    }

    [Theory]
    [InlineData("France", "DEHAM", "UNLOCODE (O10) starts with DE, but the country code of France (N10) is FR.")]
    [InlineData("Narnia", "DEHAM", "Country (N10) 'Narnia' is not in the list of countries of the form.")]
    public async Task ExcelV2_ShouldRejectForm_WhenCountryDoesNotMatchUnLocode(string country, string unLocode, string expectedError)
    {
        await WriteExisting("ZZZ");
        PrepareForm(new() { ["A10"] = "ABC", ["N10"] = country, ["O10"] = unLocode });

        var result = await Run("Add", "ABC");

        result.Should().Be(1);
        await _git.Issue.Comment.Received(1).Create("test", "repo", 1, Arg.Is<string>(comment =>
            comment.Contains(expectedError)));
    }

    [Theory]
    [InlineData("Côte d'Ivoire", "CIABJ")]
    [InlineData("Côte d’Ivoire", "CIABJ")]
    [InlineData("türkiye", "TRIST")]
    public async Task ExcelV2_ShouldAcceptCountry_WhenItMatchesUnLocode(string country, string unLocode)
    {
        await WriteExisting("ZZZ");
        PrepareForm(new() { ["A10"] = "ABC", ["N10"] = country, ["O10"] = unLocode });

        var result = await Run("Add", "ABC");

        result.Should().Be(0);
    }

    [Fact]
    public async Task ExcelV2_ShouldRejectForm_AndCommentOnIssue_WhenMandatoryFieldsAreMissing()
    {
        await WriteExisting("ZZZ");
        // The template example leaves the mandatory Country (N10) empty.
        PrepareForm(new() { ["A10"] = "ABC", ["O10"] = "DEHAMX", ["D10"] = "Shipping line" });

        var result = await Run("Add", "ABC");

        result.Should().Be(1);
        await _git.Issue.Comment.Received(1).Create("test", "repo", 1, Arg.Is<string>(comment =>
            comment.Contains("Country (N10) is required.")
            && comment.Contains("must have 5 characters")
            && comment.Contains("Carrier Type (D10) must be VOCC or NVOCC.")));
        (await _fileStore.TryReadAsync<LinerCode>("ABC", _outputDirectory)).Should().BeNull();
    }

    [Fact]
    public async Task ExcelV2_ShouldRequireCarrierType()
    {
        await WriteExisting("ZZZ");
        PrepareForm(new() { ["A10"] = "ABC", ["N10"] = "Germany", ["D10"] = "" });

        var result = await Run("Add", "ABC");

        result.Should().Be(1);
        await _git.Issue.Comment.Received(1).Create("test", "repo", 1, Arg.Is<string>(comment =>
            comment.Contains("Carrier Type (D10) is required.")));
    }

    [Fact]
    public async Task ExcelV2_ShouldRejectForm_WhenIssueCodeDoesNotMatchForm()
    {
        await WriteExisting("ZZZ");
        PrepareForm(new() { ["A10"] = "ABC", ["N10"] = "Germany" });

        var result = await Run("Add", "XYZ");

        result.Should().Be(1);
        await _git.Issue.Comment.Received(1).Create("test", "repo", 1, Arg.Is<string>(comment =>
            comment.Contains("does not match the code in the form")));
    }

    [Fact]
    public async Task ExcelV2_ShouldRejectForm_WhenTemplateLayoutIsDifferent()
    {
        await WriteExisting("ZZZ");
        PrepareForm(new() { ["A10"] = "ABC", ["N10"] = "Germany", ["O9"] = "Port", ["A11"] = "DEF" });

        var result = await Run("Add", "ABC");

        result.Should().Be(1);
        await _git.Issue.Comment.Received(1).Create("test", "repo", 1, Arg.Is<string>(comment =>
            comment.Contains("Cell O9 should be the 'UNLOCODE' header")
            && comment.Contains("row(s) 11 also contain data")));
    }

    [Fact]
    public async Task ExcelV2_ShouldRejectAdd_WhenCodeAlreadyExists()
    {
        await WriteExisting("HLC");
        PrepareForm(new() { ["N10"] = "Germany" });

        var result = await Run("Add", "HLC");

        result.Should().Be(1);
        await _git.Issue.Comment.Received(1).Create("test", "repo", 1, Arg.Is<string>(comment =>
            comment.Contains("a liner code with the same value already exists")));
    }

    [Fact]
    public async Task ExcelV2_ShouldIgnoreIssue_WithoutV2Label()
    {
        PrepareForm(new() { ["N10"] = "Germany" });

        var result = await Run("Add", "HLC", GitHubLabels.AttachmentExcel);

        result.Should().Be(1);
        await _git.Issue.Comment.DidNotReceiveWithAnyArgs().Create(default!, default!, default, default!);
    }

    private async Task<LinerCode> WriteExisting(string code)
    {
        var existing = _fixture.Build<LinerCode>()
            .With(x => x.LinerSmdgCode, code)
            .With(x => x.LinerCodeVersion, "V1")
            .With(x => x.CarrierType, CarrierType.VOCC)
            .Create();
        await _fileStore.WriteAllAsync([existing], _outputDirectory, x => x.LinerSmdgCode);
        return existing;
    }

    private void PrepareForm(Dictionary<string, string> cells)
    {
        using var workbook = new XLWorkbook(TemplatePath);
        var worksheet = workbook.Worksheet(LinerCodeFormExcelV2.SheetName);
        foreach (var (address, value) in cells)
        {
            worksheet.Cell(address).Value = value;
        }

        workbook.SaveAs(Path.Combine(_outputDirectory, CacheDirectory.Name, FileName));
    }

    private Task<int> Run(string changeType, string code, string label = GitHubLabels.AttachmentExcelV2)
    {
        var issue = new SimpleJsonSerializer().Deserialize<Issue>(JsonSerializer.Serialize(new
        {
            state = "open",
            labels = new[] { new { name = "data" }, new { name = "liner-code" }, new { name = label } },
            body = $"### Change Type\n{changeType}\n### Requester\nTest requester\n### Liner code\n{code}\n### Form attachment\n[form.xlsx](https://example.com/form.xlsx)"
        }));
        _git.Issue.Get("test", "repo", 1).Returns(issue);
        var factory = Substitute.For<IGitHubClientFactory>();
        factory.Create("test", "test-token").Returns(_git);
        var command = new LinerCodesConvertFormExcelV2Command(
            factory, new LinerCodeFormMapper(), new ExcelFile(), _fileStore);

        return command.ExecuteAsync(_context, new LinerCodesConvertFormExcelSettings
        {
            IssueNumber = 1,
            LocalFileName = FileName,
            OutputDirectory = _outputDirectory,
            Repository = "test/repo",
            Token = "test-token"
        });
    }

    private async Task AssertCombinedMatchesIndividuals(int expectedCount)
    {
        var combined = (await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory)).ToList();
        var individual = await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory, false);
        combined.Should().HaveCount(expectedCount);
        combined.Should().BeEquivalentTo(individual, options => options.WithStrictOrdering());
    }
}
