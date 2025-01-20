namespace SmdgCli.Services;

using Spectre.Console;

public class RemoteFileReader : IRemoteFileReader
{
    private readonly IHttpClientFactory _httpClientFactory;

    public RemoteFileReader(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<Stream> GetFile(string fileName, string remoteAddress)
    {
        if (File.Exists(fileName))
        {
            AnsiConsole.MarkupLine("Reading the xlsx file from: [deeppink3]Local cache[/]");
            return File.Open(fileName, FileMode.Open, FileAccess.ReadWrite);
        }

        AnsiConsole.MarkupLine("Reading the xlsx file from: [deeppink3]Remote store[/]");
        var httpRequestMessage = new HttpRequestMessage(HttpMethod.Get, remoteAddress);

        var httpClient = _httpClientFactory.CreateClient();
        var httpResponseMessage = await httpClient.SendAsync(httpRequestMessage);

        if (!httpResponseMessage.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("Remote source is unreachable");
        }

        var content = await httpResponseMessage.Content.ReadAsByteArrayAsync();
        await File.WriteAllBytesAsync(fileName, content);
        return new MemoryStream(content);
    }
}