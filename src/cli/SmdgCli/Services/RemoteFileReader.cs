namespace SmdgCli.Services;

using Spectre.Console;

public class RemoteFileReader(IHttpClientFactory httpClientFactory)
    : IRemoteFileReader
{
    public async Task<FileStream> GetFile(string filePath, string remoteAddress)
    {
        if (File.Exists(filePath))
        {
            AnsiConsole.MarkupLine("Reading the xlsx file from: [deeppink3]Local cache[/]");
            return File.Open(filePath, FileMode.Open, FileAccess.ReadWrite);
        }

        await DownloadFile(filePath, remoteAddress);
        return new FileStream(filePath, FileMode.Open, FileAccess.Read);
    }

    public async Task DownloadFile(string filePath, string remoteAddress)
    {
        if (!remoteAddress.StartsWith("https://smdg.org/wp-content/uploads/") &&
            !remoteAddress.StartsWith("https://smdg.org/documents/") &&
            !remoteAddress.StartsWith("https://github.com/"))
        {
            throw new InvalidOperationException("The URL is not a valid URL");
        }

        AnsiConsole.MarkupLine("Reading the xlsx file from: [deeppink3]Remote store[/]");
        var httpRequestMessage = new HttpRequestMessage(HttpMethod.Get, remoteAddress);

        var httpClient = httpClientFactory.CreateClient();
        var httpResponseMessage = await httpClient.SendAsync(httpRequestMessage);

        if (!httpResponseMessage.IsSuccessStatusCode)
        {
            AnsiConsole.MarkupLine($"[red]Remote source returned {httpResponseMessage.StatusCode}[/]");
            throw new InvalidOperationException("Remote source is unreachable");
        }

        var content = await httpResponseMessage.Content.ReadAsByteArrayAsync();
        await File.WriteAllBytesAsync(filePath, content);
    }
}