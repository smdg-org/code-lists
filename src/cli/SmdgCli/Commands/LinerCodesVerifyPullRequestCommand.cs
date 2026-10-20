namespace SmdgCli.Commands;

using FluentValidation.Results;
using Octokit;
using Schemas.Liners;
using Services;
using Utilities;
using Spectre.Console;
using Spectre.Console.Cli;
using ValidationResult = FluentValidation.Results.ValidationResult;

public class LinerCodesVerifyPullRequestCommand(IFileStore fileStore, IGitHubClientFactory gitHubClientFactory)
    : AsyncCommand<LinerCodesVerifyPullRequestSettings>
{
    public override async Task<int> ExecuteAsync(CommandContext context, LinerCodesVerifyPullRequestSettings settings)
    {
        AnsiConsole.MarkupLine($"[bold blue]Verifying liner codes for pull request {settings.PullRequest}...[/]");

        var (owner, repository) = GitHubUtils.GetOwnerAndRepo(settings.Repository);

        var git = gitHubClientFactory.Create(owner, settings.Token);

        var changedFiles = await git.PullRequest.Files(owner, repository, settings.PullRequest);
        var outputDirectory = RepositoryPathUtils.NormalizeRepositoryRelativePath(
            settings.OutputDirectory,
            RepositoryPathUtils.GetRepositoryRoot());

        var fileNames = changedFiles
            .Where(f => f.FileName.StartsWith($"{outputDirectory}/", StringComparison.Ordinal))
            .Select(f =>
            {
                var fileName = Path.GetFileNameWithoutExtension(f.FileName);
                var fullFileName = Path.GetFileName(f.FileName);

                return (FileName: fileName, FullFileName: fullFileName, IsRemoved:
                    string.Equals(f.Status.ToString(), "removed", StringComparison.OrdinalIgnoreCase));
            })
            .ToList();

        var codeFiles = fileNames
            .Where(f =>
                f.FullFileName.EndsWith(".json", StringComparison.InvariantCultureIgnoreCase) &&
                !string.Equals(f.FullFileName, FileStore.IndexFileName, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(f.FullFileName, FileStore.CombinedFileName, StringComparison.OrdinalIgnoreCase))
            .ToList();
        var codeFileNames = codeFiles.Where(f => !f.IsRemoved).Select(f => f.FileName).ToList();
        var removedCodeFileNames = codeFiles.Where(f => f.IsRemoved).Select(f => f.FileName).ToList();
        
        var indexHasChanged = fileNames.Any(f => f.FullFileName == FileStore.IndexFileName);
        var combinedHasChanged = fileNames.Any(f => f.FullFileName == FileStore.CombinedFileName);

        await git.ClearValidationComments(owner, repository, settings.PullRequest, GitHubComments.PullRequestValidationMarker);

        var validCodes = await ValidateLinerCodeFiles(git, owner, repository, settings.PullRequest, codeFileNames, settings.OutputDirectory);
        var validDeletions = await ValidateRemovedLinerCodeFiles(git, owner, repository, settings.PullRequest, removedCodeFileNames, settings.OutputDirectory);
        
        var validIndex = !indexHasChanged || await ValidateIndexFile(git, owner, repository, settings.PullRequest, settings.OutputDirectory);
        
        var validCombined = !combinedHasChanged || await ValidateCombinedFile(git, owner, repository, settings.PullRequest, settings.OutputDirectory);
        
        var allChangesAreValid = validCodes && validDeletions && validIndex && validCombined;
        
        AnsiConsole.WriteLine(allChangesAreValid
            ? "[green]All liner code changes are valid.[/]"
            : "[red]Some liner code changes are invalid.[/]");

        return allChangesAreValid ? 0 : 1;
    }

    private async Task<bool> ValidateIndexFile(
        IGitHubClient git,
        string owner,
        string repository,
        int pullRequest,
        string directory)
    {
        var index = await fileStore.TryReadAsync<LinerCodeIndex>("_index", directory);
        if (index is null)
        {
            AnsiConsole.MarkupLine("[red] Index file is not a valid file. [/]");
            return false;
        }
        
        AnsiConsole.MarkupLine($"Validating index file in PR #{pullRequest}...");

        var validationResult = await (new LinerCodeIndexValidator())
            .ValidateAsync(index!);

        var comment = GitHubUtils.GenerateComment(
            validationResult,
            GitHubComments.PullRequestValidationMarker,
            $"Liner code index is valid",
            "Please review, approve and merge the changes",
            $"Liner code index file is invalid",
            "Please fix the changes in the Pull Request."
        );

        await git.Issue.Comment.Create(owner, repository, pullRequest, comment);
        return validationResult.IsValid;
        
    }
    
    private async Task<bool> ValidateCombinedFile(
        IGitHubClient git,
        string owner,
        string repository,
        int pullRequest,
        string directory)
    {
        var combined = await fileStore.TryReadAsync<List<LinerCode>>("_combined", directory);
        if (combined is null)
        {
            AnsiConsole.MarkupLine("[red] Combined file is not a valid file. [/]");
            return false;
        }

        AnsiConsole.MarkupLine($"Validating file combined file in PR #{pullRequest}...");

        var codeValidationResults = new Dictionary<string, FluentValidation.Results.ValidationResult>();

        foreach (var changedLinerCode in combined)
        {

            var validationResult = await (new LinerCodeValidator())
                .ValidateAsync(changedLinerCode!);

            codeValidationResults.Add(changedLinerCode.LinerSmdgCode, validationResult);
        }

        var comment = GitHubUtils.GenerateComment(
            codeValidationResults,
            GitHubComments.PullRequestValidationMarker,
            $"Combined data file is valid",
            "Please review, approve and merge the changes",
            $"Combined data file is invalid",
            "Please fix the changes in the Pull Request."
        );

        await git.Issue.Comment.Create(owner, repository, pullRequest, comment);
        return codeValidationResults.All(r => r.Value.IsValid);
    }

    private async Task<bool> ValidateLinerCodeFiles(
        IGitHubClient git,
        string owner,
        string repository,
        int pullRequest,
        IEnumerable<string> fileNames,
        string directory)
    {
        var codeValidationResults = new Dictionary<string, FluentValidation.Results.ValidationResult>();

        foreach (var fileName in fileNames)
        {
            AnsiConsole.MarkupLine($"Validating file {fileName} in PR #{pullRequest}...");

            var changedLinerCode = await fileStore.TryReadAsync<LinerCode>(fileName, directory);
            if (changedLinerCode is null)
            {
                var message = $"Changed file '{fileName}.json' is missing or is not a valid liner code file.";
                AnsiConsole.MarkupLine($"[red]{Markup.Escape(message)}[/]");
                codeValidationResults.Add(fileName, new ValidationResult([new ValidationFailure(fileName, message)]));
                continue;
            }

            var validationResult = await (new LinerCodeValidator())
                .ValidateAsync(changedLinerCode!);

            codeValidationResults.Add(fileName, validationResult);
        }

        var comment = GitHubUtils.GenerateComment(
            codeValidationResults,
            GitHubComments.PullRequestValidationMarker,
            $"Liner code changes are valid ({codeValidationResults.Count} files validated)",
            "Please review, approve and merge the changes",
            $"Liner code changes are invalid",
            "Please fix the changes in the Pull Request."
        );

        await git.Issue.Comment.Create(owner, repository, pullRequest, comment);
        return codeValidationResults.All(r => r.Value.IsValid);
    }

    private async Task<bool> ValidateRemovedLinerCodeFiles(
        IGitHubClient git,
        string owner,
        string repository,
        int pullRequest,
        IReadOnlyCollection<string> fileNames,
        string directory)
    {
        if (fileNames.Count == 0)
        {
            return true;
        }

        var index = await fileStore.TryReadAsync<LinerCodeIndex>("_index", directory);
        var combined = await fileStore.TryReadAsync<List<LinerCode>>("_combined", directory);
        var results = new Dictionary<string, ValidationResult>();

        foreach (var fileName in fileNames)
        {
            var result = new ValidationResult();
            if (index?.LinerCodeFiles is null)
            {
                result.Errors.Add(new ValidationFailure(fileName,
                    $"Cannot verify deleted code '{fileName}': {FileStore.IndexFileName} is missing or invalid."));
            }
            else if (index.LinerCodeFiles.Contains($"{fileName}.json", StringComparer.OrdinalIgnoreCase))
            {
                result.Errors.Add(new ValidationFailure(fileName,
                    $"Deleted code '{fileName}' is still referenced in {FileStore.IndexFileName}."));
            }

            if (combined is null)
            {
                result.Errors.Add(new ValidationFailure(fileName,
                    $"Cannot verify deleted code '{fileName}': {FileStore.CombinedFileName} is missing or invalid."));
            }
            else if (combined.Any(code => string.Equals(code?.LinerSmdgCode, fileName, StringComparison.OrdinalIgnoreCase)))
            {
                result.Errors.Add(new ValidationFailure(fileName,
                    $"Deleted code '{fileName}' is still referenced in {FileStore.CombinedFileName}."));
            }

            foreach (var error in result.Errors)
            {
                AnsiConsole.MarkupLine($"[red]{Markup.Escape(error.ErrorMessage)}[/]");
            }

            results.Add(fileName, result);
        }

        var comment = GitHubUtils.GenerateComment(
            results,
            GitHubComments.PullRequestValidationMarker,
            "Liner code deletions are consistent",
            "Please review, approve and merge the changes",
            "Liner code deletions are inconsistent",
            "Please fix the changes in the Pull Request."
        );
        comment += $"\nDeleted liner codes: {string.Join(", ", fileNames.Select(name => $"`{name}`"))}.\n";

        await git.Issue.Comment.Create(owner, repository, pullRequest, comment);
        return results.All(r => r.Value.IsValid);
    }
}