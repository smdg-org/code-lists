namespace SmdgCli.Commands;

using Octokit;
using Schemas.Liners;
using Schemas.Liners.Conversion;
using Services;
using Spectre.Console;
using Spectre.Console.Cli;
using Utilities;

public class LinerCodesPackExcelCommand(
    IGitHubClientFactory gitHubClientFactory,
    IFileStore fileStore,
    IExcelFile excelFile,
    IMapper<LinerCode, LinerCodeExcel, LinerCodeChangeExcel> mapper,
    IExcelMapper<LinerCodeExcel> excelMapper,
    IExcelMapper<LinerCodeChangeExcel> excelChangeMapper)
    : AsyncCommand<LinerCodesPackExcelSettings>
{
    public override async Task<int> ExecuteAsync(
        CommandContext context,
        LinerCodesPackExcelSettings settings)
    {
        var cacheDirectory = Path.Join(settings.OutputDirectory, "cache");
        if (!Directory.Exists(cacheDirectory))
        {
            Directory.CreateDirectory(cacheDirectory);
        }

        var (owner, repository) = GitHubUtils.GetOwnerAndRepo(settings.Repository);

        var git = gitHubClientFactory.Create(owner, settings.Token);

        var version = VersionUtils.GetReleaseVersion(settings.RunNumber, settings.Branch != "main");
        
        var jsonAssetName = $"SMDG-Liner-codes-list-combined-{version}.json";
        var excelAssetName = $"SMDG-Liner-codes-list-{version}.xlsx";

        var combinedFile = Path.Combine(settings.OutputDirectory, FileStore.CombinedFileName);
        var templateFile = Path.Combine(settings.OutputDirectory, "templates", "smdg-liner-codes-list-template.xlsx");
        var excelOutputFile = Path.Combine(settings.OutputDirectory, "cache", excelAssetName);
        
        var combinedData = await fileStore.ReadAllAsync<LinerCode>(settings.OutputDirectory, readFromCombined: true);
    
        var tuples = combinedData
            .Select(mapper.ReverseMap)
            .ToList();

        var codes = tuples
            .Select(t => excelMapper.ReverseMap(t.Source))
            .ToList();

        var changes = tuples
            .SelectMany(t => t.SourceChanges)
            .OrderBy(c => c.LastUpdate)
            .Select(excelChangeMapper.ReverseMap)
            .ToList();
        
        excelFile.Write(
            new CodeDictionaries() { Codes = codes, Changes = changes },
            LinerCodeExcel.ExpectedHeaders,
            LinerCodeChangeExcel.ExpectedHeaders,
            templateFile,
            excelOutputFile);

        var newRelease = new NewRelease(version)
        {
            Name = $"Liner Codes - {version}",
            Body = "Excel package containing liner codes",
            Draft = true,
            Prerelease = false
        };
        
        var release = await git.Repository.Release.Create(owner, repository, newRelease);

        var uploadCombined = new ReleaseAssetUpload
        {
            FileName = jsonAssetName,
            ContentType = "application/json",
            RawData = File.OpenRead(combinedFile),
        };
        var assetCombined = await git.Repository.Release.UploadAsset(release, uploadCombined);
        if (assetCombined == null)
        {
            AnsiConsole.MarkupLine("[red]Failed to upload combined JSON file.[/]");
            return 1;
        }

        var uploadExcel = new ReleaseAssetUpload
        {
            FileName = excelAssetName,
            ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            RawData = File.OpenRead(excelOutputFile),
        };
        var assetExcel = await git.Repository.Release.UploadAsset(release, uploadExcel);
        if (assetExcel == null)
        {
            AnsiConsole.MarkupLine("[red]Failed to upload Excel file.[/]");
            return 1;
        }

        await git.Repository.Release.Edit(owner, repository, release.Id, new ReleaseUpdate() { Draft = false });
        
        return 0;
    }
}