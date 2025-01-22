namespace SmdgCli.Services;

using Octokit;

public interface IGitHubClientFactory
{
    IGitHubClient Create(string owner, string token);
}