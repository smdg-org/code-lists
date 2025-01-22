namespace SmdgCli.Utilities;

using System.Text;
using System.Text.RegularExpressions;
using FluentValidation.Results;
using Octokit;

public static partial class GitHubUtils
{
    public static (string Owner, string Repository) GetOwnerAndRepo(string repositoryFullName)
    {
        var parts = repositoryFullName.Split('/');
        if (parts.Length == 2)
        {
            return (parts[0], parts[1]);
        }
        throw new ArgumentException("Input must be in the format 'owner/repository'.");
    }

    public static string GenerateComment(
        Dictionary<string, ValidationResult> results,
        string marker,
        string successMessage,
        string successAction,
        string failureMessage,
        string failureAction)
    {
        var commentBuilder = new StringBuilder();
        commentBuilder.AppendLine(marker);

        var allValid = results.All(r => r.Value.IsValid);
        if (allValid)
        {
            commentBuilder
                .AppendLine($"### :tada: {successMessage}")
                .AppendLine(string.Empty)
                .AppendLine(successAction);
        }
        else
        {
            commentBuilder
                .AppendLine($"### :red_circle: {failureMessage}")
                .AppendLine("The following errors were found:")
                .AppendLine(string.Empty);

            foreach (var result in results)
            {
                commentBuilder.AppendLine($"#### {result.Key}");
                result.Value.Errors.ForEach(e =>
                {
                    commentBuilder.AppendLine($"**{e.ErrorMessage}**");
                });
            }

            commentBuilder
                .AppendLine(string.Empty)
                .AppendLine(failureAction);
        }

        return commentBuilder.ToString();
    }

    public static string GenerateComment(ValidationResult? validationResult, string marker, string successMessage, string successAction, string failureMessage, string failureAction)
    {
        var commentBuilder = new StringBuilder();

        commentBuilder.AppendLine(marker);

        if (validationResult is null)
        {
            commentBuilder.AppendLine($"### :red_circle: {failureMessage}");
            commentBuilder.AppendLine("We could not find validator for that change type.");
        }
        else if (validationResult.IsValid)
        {
            commentBuilder
                .AppendLine($"### :tada: {successMessage}")
                .AppendLine(string.Empty)
                .AppendLine(successAction);
        }
        else
        {
            commentBuilder
                .AppendLine($"### :red_circle: {failureMessage}")
                .AppendLine("The following errors were found:")
                .AppendLine(string.Empty);
        
            validationResult.Errors.ForEach(e =>
            {
                commentBuilder.AppendLine($"**{e.ErrorMessage}**");
            });

            commentBuilder
                .AppendLine(string.Empty)
                .AppendLine(failureAction);
        }

        return commentBuilder.ToString();
    }

    public static async Task ClearValidationComments(this IGitHubClient git, string owner, string repository, int issueNumber, string marker)
    {
        var comments = await git.Issue.Comment.GetAllForIssue(owner, repository, issueNumber);
        if (comments is null)
        {
            return;
        }

        var validationComments = comments
            .Where(c => c.Body.StartsWith(marker, StringComparison.InvariantCultureIgnoreCase))
            .ToList();

        foreach (var comment in validationComments)
        {
            await git.Issue.Comment.Delete(owner, repository, comment.Id);
        }
    }
    
    public static (string FileName, string FileUrl) ExtractAttachment(this string attachmentText)
    {
        if (attachmentText is null)
        {
            throw new ArgumentException(null, nameof(attachmentText));
        }

        var match = AttachmentRegex().Match(attachmentText);

        return match.Success
            ? (match.Groups[1].Value, match.Groups[2].Value)
            : (string.Empty, string.Empty);
    }

    [GeneratedRegex(@"\[(.*?)\]\((.*?)\)")]
    private static partial Regex AttachmentRegex();
}