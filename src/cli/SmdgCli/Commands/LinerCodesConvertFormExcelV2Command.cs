namespace SmdgCli.Commands;

using FluentValidation.Results;
using Octokit;
using Schemas.Liners;
using Schemas.Liners.Conversion;
using Services;
using Spectre.Console;
using Spectre.Console.Cli;
using Utilities;
using ValidationResult = FluentValidation.Results.ValidationResult;

/// <summary>
/// Processes an issue with the V2 Excel application form attached (fixed layout, structured address).
/// </summary>
public class LinerCodesConvertFormExcelV2Command(
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

            if (issue.Labels.All(l => l.Name != GitHubLabels.AttachmentExcelV2))
            {
                AnsiConsole.MarkupLine($"[red]Issue {settings.IssueNumber} does not have the {GitHubLabels.AttachmentExcelV2} label.[/]");
                return 1;
            }

            AnsiConsole.MarkupLine($"[green]Processing liner code application form (V2) from an issue #{settings.IssueNumber}.[/]");
            AnsiConsole.WriteLine($"Issue: {issue.Title}");

            var issueForm = Markdown.ParseForm<LinerCodeFormExcel>(issue.Body);
            if (issueForm is null)
            {
                AnsiConsole.MarkupLine("[red]Issue does not contain a valid form.[/]");
                return 1;
            }

            var cacheDirectory = Path.Combine(settings.OutputDirectory, CacheDirectory.Name);
            if (!File.Exists(Path.Combine(cacheDirectory, settings.LocalFileName)))
            {
                AnsiConsole.MarkupLine("[red]The form attachment is missing from the local path. Please make sure it is downloaded before running this command.[/]");
                return 1;
            }

            var cells = excelFile.ReadCells(settings.LocalFileName, LinerCodeFormExcelV2.SheetName, cacheDirectory);

            List<ValidationFailure> failures;
            LinerCodeForm? linerCodeForm = null;
            LinerCode? existingLinerCode = null;
            if (cells is null)
            {
                failures =
                [
                    new ValidationFailure(
                        "Form attachment",
                        $"The attachment could not be read. Please attach the V2 application form (.xlsx) with the '{LinerCodeFormExcelV2.SheetName}' sheet.")
                ];
            }
            else
            {
                (linerCodeForm, failures) = LinerCodeFormExcelV2.ToForm(cells, issueForm);

                if (!string.IsNullOrWhiteSpace(issueForm.LinerCode)
                    && !string.Equals(issueForm.LinerCode.Trim(), linerCodeForm.LinerCode, StringComparison.InvariantCultureIgnoreCase))
                {
                    failures.Add(new ValidationFailure(
                        "Liner Code",
                        $"The liner code in the issue ({issueForm.LinerCode.Trim()}) does not match the code in the form ({linerCodeForm.LinerCode})."));
                }

                if (!string.IsNullOrWhiteSpace(linerCodeForm.LinerCode))
                {
                    existingLinerCode = await fileStore
                        .TryReadAsync<LinerCode>(linerCodeForm.LinerCode, settings.OutputDirectory);
                }

                var mergeResult = await new LinerCodeFormMergeValidator()
                    .ValidateAsync(new LinerCodeFormMerge
                    {
                        FromData = linerCodeForm,
                        ExistingData = existingLinerCode
                    });
                var formResult = await new LinerCodeFormV2Validator().ValidateAsync(linerCodeForm);

                failures.AddRange(mergeResult.Errors);
                failures.AddRange(formResult.Errors);
            }

            var validationResult = new ValidationResult(failures);

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

            if (!validationResult.IsValid || linerCodeForm is null)
            {
                AnsiConsole.MarkupLine("[red]The form is not valid. Exiting.[/]");
                return 1;
            }

            var linerCode = linerCodeForm.ChangeType switch
            {
                "Add" => mapper.MapAdd(linerCodeForm),
                _ => mapper.MapUpdate(linerCodeForm, existingLinerCode!),
            };

            // MapUpdate takes the remarks from the change comments; the V2 form has a Remarks column (R10).
            if (linerCodeForm.Remarks is not null)
            {
                linerCode = linerCode with { Remarks = linerCodeForm.Remarks };
            }

            await fileStore.UpsertSingleAsync(linerCode.LinerSmdgCode, linerCode, settings.OutputDirectory);
        }
        catch (Exception ex)
        {
            AnsiConsole.MarkupLine($"[red]Error processing the issue #{settings.IssueNumber}. {ex.Message}[/]");
            return 1;
        }

        return 0;
    }
}
