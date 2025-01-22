namespace SmdgCli.Test.Services;

using AutoFixture;
using FluentAssertions;
using NSubstitute;
using SmdgCli.Services;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Tools;
using Xunit;

public class RemoteFileReaderTests
{
    private readonly IFixture _fixture;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly RemoteFileReader _remoteFileReader;

    public RemoteFileReaderTests()
    {
        _fixture = new Fixture();
        _httpClientFactory = Substitute.For<IHttpClientFactory>();
        _remoteFileReader = new RemoteFileReader(_httpClientFactory);
    }

    [Fact]
    public async Task GetFile_ShouldReturnFileStream_WhenFileExistsLocally()
    {
        // Arrange
        var fileName = $"{_fixture.Create<string>()}.xlsx";
        var remoteAddress = $"https://smdg.org/documents/{fileName}";
        await File.WriteAllTextAsync(fileName, "test content");

        // Act
        var result = await _remoteFileReader.GetFile(fileName, remoteAddress);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<FileStream>();

        // Cleanup
        result.Close();
        File.Delete(fileName);
    }

    [Fact]
    public async Task GetFile_ShouldDownloadFile_WhenFileDoesNotExistLocally()
    {
        // Arrange
        var fileName = $"{_fixture.Create<string>()}.xlsx";
        var remoteAddress = $"https://smdg.org/documents/{fileName}";
        var httpResponseMessage = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(_fixture.Create<byte[]>())
        };

        var handlerMock = new MockHttpMessageHandler();
        handlerMock.WhenSendAsync((req, token) => Task.FromResult(httpResponseMessage));

        var httpClient = new HttpClient(handlerMock);

        _httpClientFactory
            .CreateClient()
            .Returns(httpClient);

        // Act
        var result = await _remoteFileReader.GetFile(fileName, remoteAddress);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<FileStream>();

        // Cleanup
        result.Close();
        File.Delete(fileName);
    }

    [Fact]
    public async Task DownloadFile_ShouldThrowInvalidOperationException_WhenUrlIsInvalid()
    {
        // Arrange
        var fileName = $"{_fixture.Create<string>()}.xlsx";
        var remoteAddress = $"https://invalid-url.com/{fileName}";

        // Act
        Func<Task> act = async () => await _remoteFileReader.DownloadFile(fileName, remoteAddress);

        // Assert
        await act.Should()
            .ThrowAsync<InvalidOperationException>()
            .WithMessage("The URL is not a valid URL");
    }

    [Fact]
    public async Task DownloadFile_ShouldThrowInvalidOperationException_WhenRemoteSourceIsUnreachable()
    {
        // Arrange
        var fileName = $"{_fixture.Create<string>()}.xlsx";
        var remoteAddress = $"https://smdg.org/documents/{fileName}";
        var httpResponseMessage = new HttpResponseMessage(HttpStatusCode.NotFound);

        var handlerMock = new MockHttpMessageHandler();
        handlerMock.WhenSendAsync((req, token) => Task.FromResult(httpResponseMessage));

        var httpClient = new HttpClient(handlerMock);

        _httpClientFactory
            .CreateClient()
            .Returns(httpClient);

        // Act
        var act = async () => await _remoteFileReader.DownloadFile(fileName, remoteAddress);

        // Assert
        await act.Should()
            .ThrowAsync<InvalidOperationException>()
            .WithMessage("Remote source is unreachable");
    }
}