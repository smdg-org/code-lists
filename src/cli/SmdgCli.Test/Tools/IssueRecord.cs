namespace SmdgCli.Test.Tools;

using Octokit;

public record IssueRecord(
    long Id,
    string NodeId,
    string Url,
    string HtmlUrl,
    string CommentsUrl,
    string EventsUrl,
    int Number,
    ItemState State,
    ItemStateReason StateReason,
    string Title,
    string Body,
    User ClosedBy,
    User User,
    IReadOnlyList<Label> Labels,
    User Assignee,
    IReadOnlyList<User> Assignees,
    Milestone Milestone,
    int Comments,
    PullRequest PullRequest,
    DateTimeOffset? ClosedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    bool Locked,
    Repository Repository,
    ReactionSummary Reactions,
    LockReason ActiveLockReason)
{
    public Issue ToIssue()
    {
        return new Issue(
            Url,
            HtmlUrl,
            CommentsUrl,
            EventsUrl,
            Number,
            State,
            Title,
            Body,
            ClosedBy,
            User,
            Labels,
            Assignee,
            Assignees,
            Milestone,
            Comments,
            PullRequest,
            ClosedAt,
            CreatedAt,
            UpdatedAt,
            Id,
            NodeId,
            Locked,
            Repository,
            Reactions,
            ActiveLockReason,
            StateReason
        );
    }
}