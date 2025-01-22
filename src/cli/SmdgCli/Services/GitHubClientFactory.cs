namespace SmdgCli.Services;

using Octokit;

public class GitHubClientFactory : IGitHubClientFactory
{
    public IGitHubClient Create(string owner, string token)
    {
        var product = new ProductHeaderValue(owner);
        var git = new GitHubClient(product) { Credentials = new Credentials(token) };
        return git;
    }
}