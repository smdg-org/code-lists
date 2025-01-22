namespace SmdgCli.Commands;

using Octokit;
using Services;
using Spectre.Console;
using Spectre.Console.Cli;
using Utilities;

public class DownloadAttachmentCommand(IRemoteFileReader remoteFileReader, IGitHubClientFactory gitHubClientFactory)
    : AsyncCommand<DownloadAttachmentSettings>
{
    public override async Task<int> ExecuteAsync(CommandContext context, DownloadAttachmentSettings settings)
    {
        CacheDirectory.Ensure(settings.OutputDirectory);

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

            if (issue.Labels.All(l => l.Name != GitHubLabels.AttachmentExcel && l.Name != GitHubLabels.AttachmentBulk))
            {
                AnsiConsole.MarkupLine($"[red]Issue {settings.IssueNumber} does not have {GitHubLabels.AttachmentExcel} or {GitHubLabels.AttachmentBulk} label.[/]");
                return 1;
            }

            AnsiConsole.MarkupLine($"[green]Downloading attachment from an issue #{settings.IssueNumber}.[/]");

            var form = Markdown.ParseForm<Dictionary<string, string>>(issue.Body);
            if (form is null)
            {
                AnsiConsole.MarkupLine("[red]Issue does not contain a valid form.[/]");
                return 1;
            }

            var attachmentKeys = form.Keys
                .Where(k => k.Contains("attachment", StringComparison.InvariantCultureIgnoreCase))
                .ToList();

            if (attachmentKeys.Count == 0)
            {
                AnsiConsole.MarkupLine("[red]The form does not contain an attachment.[/]");
                return 1;
            }

            foreach (var key in attachmentKeys)
            {
                var (fileName, fileUrl) = form[key].ExtractAttachment();
                if (!fileName.EndsWith(".xlsx") && !fileUrl.EndsWith(".xlsx"))
                {
                    continue;
                }
                
                var filePath = Path.Combine(settings.OutputDirectory, CacheDirectory.Name, settings.LocalFileName);

                await remoteFileReader.DownloadFile(filePath, fileUrl);
            }
        }
        catch (Exception ex)
        {
            AnsiConsole.MarkupLine($"[red]Error processing the issue #{settings.IssueNumber}. {ex.Message}[/]");
            return 1;
        }

        return 0;
    }
}