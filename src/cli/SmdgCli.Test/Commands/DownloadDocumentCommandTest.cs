namespace SmdgCli.Test.Commands;

using FluentAssertions;
using NSubstitute;
using SmdgCli.Commands;
using SmdgCli.Services;
using Spectre.Console.Cli;
using Xunit;

public class DownloadDocumentCommandTest
{
    private readonly IRemoteFileReader _remoteFileReader;
    private readonly DownloadDocumentCommand _command;
    private readonly CommandContext _context;
    private readonly DownloadDocumentSettings _settings;

    public DownloadDocumentCommandTest()
    {
        var remainingArgs = Substitute.For<IRemainingArguments>();

        _remoteFileReader = Substitute.For<IRemoteFileReader>();
        _command = new DownloadDocumentCommand(_remoteFileReader);
        _context = new CommandContext([], remainingArgs, "", "");
        _settings = new DownloadDocumentSettings
        {
            OutputDirectory = "output",
            FileName = "document.pdf",
            Url = "http://example.com/document.pdf"
        };
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnZero_WhenDownloadIsSuccessful()
    {
        // Act
        var result = await _command.ExecuteAsync(_context, _settings);

        // Assert
        result.Should().Be(0);
        await _remoteFileReader.Received().DownloadFile(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnOne_WhenDownloadFails()
    {
        // Arrange
        _remoteFileReader
            .When(x => x.DownloadFile(Arg.Any<string>(), Arg.Any<string>()))
            .Do(x => { throw new Exception("Download failed"); });

        // Act
        var result = await _command.ExecuteAsync(_context, _settings);

        // Assert
        result.Should().Be(1);
    }
}