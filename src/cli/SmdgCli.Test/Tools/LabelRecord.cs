namespace SmdgCli.Test.Tools;

using Octokit;

public record LabelRecord(
    long Id,
    string Url,
    string Name,
    string NodeId,
    string Color,
    string Description,
    bool Default
)
{
    public Label ToLabel()
    {
        return new Label(
            Id,
            Url,
            Name,
            NodeId,
            Color,
            Description,
            Default
        );
    }
}

