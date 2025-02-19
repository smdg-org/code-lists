namespace SmdgCli.Commands;

using Octokit;
using Schemas.Liners;
using Schemas.Liners.Conversion;
using Services;
using Spectre.Console;
using Spectre.Console.Cli;
using Utilities;

public class LinerCodesConvertFormExcelCommand(
    IGitHubClientFactory gitHubClientFactory,
    LinerCodeFormMapper mapper,
    IExcelFile excelFile,
    IFileStore fileStore)
    : AsyncCommand<LinerCodesConvertFormExcelSettings>
{
    public override async Task<int> ExecuteAsync(
        CommandContext context,
        LinerCodesConvertFormExcelSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.LocalFileName))
        {
            AnsiConsole.MarkupLine("[red]The local file name is missing from the command arguments.[/]");
            return 1;
        }
        
        var (owner, repository) = GitHubUtils.GetOwnerAndRepo(settings.Repository);

        var git = gitHubClientFactory.Create(owner, settings.Token);

        try
        {
            var issue = await git.Issue.Get(owner, repository, settings.IssueNumber);
            if (issue.State != ItemState.Open)
            {
                AnsiConsole.MarkupLine($"[red]Issue {settings.IssueNumber} is not open.[/]");
                return 1;
            }

            if (issue.Labels.All(l => l.Name != "liner-code" && l.Name != "data" && l.Name != "format-excel"))
            {
                AnsiConsole.MarkupLine($"[red]Issue {settings.IssueNumber} does not have format-excel, liner-code and data labels.[/]");
                return 1;
            }

            AnsiConsole.MarkupLine($"[green]Processing liner code application form from an issue #{settings.IssueNumber}.[/]");
            AnsiConsole.WriteLine($"Issue: {issue.Title}");

            var linerCodeFormExcel = Markdown.ParseForm<LinerCodeFormExcel>(issue.Body);
            if (linerCodeFormExcel is null)
            {
                AnsiConsole.MarkupLine("[red]Issue does not contain a valid form.[/]");
                return 1;
            }

            var existingLinerCode = await fileStore
                .TryReadAsync<LinerCode>(linerCodeFormExcel.LinerCode!, settings.OutputDirectory);

            if (!File.Exists(Path.Combine(settings.OutputDirectory, CacheDirectory.Name, settings.LocalFileName)))
            {
                AnsiConsole.MarkupLine("[red]The form attachment is missing from the local path. Please make sure it is downloaded before running this command.[/]");
                return 1;
            }

            var data = excelFile.Read(
                settings.LocalFileName,
                "Application form liner codes",
                LinerCodeFormExcel.ExpectedHeaders,
                Path.Combine(settings.OutputDirectory, CacheDirectory.Name));

            if (data is null)
            {
                AnsiConsole.MarkupLine("[red]The form attachment is not valid. Exiting.[/]");
                return 1;
            }

            if (data.Count != 1)
            {
                AnsiConsole.MarkupLine("[red]The form attachment must contain exactly one change. Exiting.[/]");
                return 1;
            }

            var linerCodeForm = linerCodeFormExcel.AsNormal(data.First());

            var validationResult = await new LinerCodeFormMergeValidator()
                .ValidateAsync(new LinerCodeFormMerge()
                {
                    FromData = linerCodeForm,
                    ExistingData = existingLinerCode
                });

            var comment = GitHubUtils.GenerateComment(
                validationResult,
                GitHubComments.IssueValidationMarker,
                "The form is valid.",
                "Pull request will be created shortly.",
                "The form is not valid.",
                "Kindly update the form with accurate information.");

            AnsiConsole.MarkupLine("[green]Clearing previous validation comments from the issue.[/]");
            await git.ClearValidationComments(owner, repository, settings.IssueNumber, GitHubComments.IssueValidationMarker);

            await git.Issue.Comment.Create(owner, repository, settings.IssueNumber, comment);

            if (validationResult is null || !validationResult.IsValid)
            {
                // Return if the form is not valid
                AnsiConsole.MarkupLine("[red]The form is not valid. Exiting.[/]");
                return 1;
            }

            // Map the form to a liner code
            var linerCode = linerCodeFormExcel.ChangeType?.ToLower() switch
            {
                "add" => mapper.MapAdd(linerCodeForm),
                "update" => mapper.MapUpdate(linerCodeForm, existingLinerCode!),
                "delete" => mapper.MapDelete(linerCodeForm, existingLinerCode!),
                _ => null
            };

            await fileStore.UpsertSingleAsync(linerCode!.LinerSmdgCode, linerCode, settings.OutputDirectory);
        }
        catch (Exception ex)
        {
            AnsiConsole.MarkupLine($"[red]Error processing the issue #{settings.IssueNumber}. {ex.Message}[/]");
            return 1;
        }

        return 0;
    }
}