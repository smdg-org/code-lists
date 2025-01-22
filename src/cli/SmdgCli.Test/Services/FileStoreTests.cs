namespace SmdgCli.Test.Services;

using AutoFixture;
using FluentAssertions;
using SmdgCli.Services;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using SmdgCli.Schemas.Liners;
using Xunit;

public class FileStoreTests
{
    private readonly Fixture _fixture = new();
    private readonly FileStore _fileStore = new();

    public FileStoreTests()
    {
        _fixture.Customizations.Add(new DateOnlySpecimenBuilder());
    }

    [Fact]
    public async Task TryReadAsync_ShouldReturnDeserializedObject_WhenFileExists()
    {
        // Arrange
        var code = _fixture.Create<string>();
        var outputDirectory = Directory.GetCurrentDirectory();
        var expectedObject = _fixture.Create<LinerCode>();
        var filePath = Path.Combine(outputDirectory, $"{code.ToLower()}.json");
        
        await File.WriteAllTextAsync(filePath, JsonSerializer.Serialize(expectedObject, FileStore.JsonOptions));

        // Act
        var result = await _fileStore.TryReadAsync<LinerCode>(code, outputDirectory);

        // Assert
        result.Should().BeEquivalentTo(expectedObject);

        // Cleanup
        File.Delete(filePath);
    }

    [Fact]
    public async Task TryReadAsync_ShouldReturnNull_WhenFileDoesNotExist()
    {
        // Arrange
        var code = "nonExistentCode";

        // Act
        var result = await _fileStore.TryReadAsync<LinerCode>(code, Directory.GetCurrentDirectory());

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task ReadAllAsync_ShouldReturnDeserializedObjects_WhenFilesExist()
    {
        // Arrange
        var outputDirectory = Directory.GetCurrentDirectory();
        var indexFile = Path.Combine(outputDirectory, FileStore.IndexFileName);
        var expectedObjects = _fixture
            .CreateMany<LinerCode>(3)
            .ToList();
        var codes = expectedObjects
            .Select(obj => (Data: obj, FilePath: Path.Combine(outputDirectory, $"{obj.LinerSmdgCode.ToLower()}.json")))
            .ToList();
        var indexContent = new LinerCodeIndex(codes.Select(t => t.FilePath).OrderBy(x => x));
    
        foreach (var code in codes)
        {
            await File.WriteAllTextAsync(code.FilePath, JsonSerializer.Serialize(code.Data, FileStore.JsonOptions));
        }
        await File.WriteAllTextAsync(indexFile, JsonSerializer.Serialize(indexContent, FileStore.JsonOptions));

        // Act
        var result = await _fileStore.ReadAllAsync<LinerCode>(outputDirectory, false);

        // Assert
        result.Should().BeEquivalentTo(expectedObjects);

        // Cleanup
        foreach (var code in codes)
        {
            File.Delete(code.FilePath);
        }
        File.Delete(indexFile);
    }

    [Fact]
    public async Task UpsertSingleAsync_ShouldCreateOrUpdateFile_WhenCalled()
    {
        // Arrange
        var code = _fixture.Create<string>();
        var outputDirectory = Directory.GetCurrentDirectory();
        var record = _fixture.Create<LinerCode>();
        var indexFile = Path.Combine(outputDirectory, FileStore.IndexFileName);
        var indexContent = new LinerCodeIndex([]);
        await File.WriteAllTextAsync(indexFile, JsonSerializer.Serialize(indexContent, FileStore.JsonOptions));

        // Act
        await _fileStore.UpsertSingleAsync(code, record, outputDirectory);

        // Assert
        var filePath = Path.Combine(outputDirectory, $"{code.ToLower()}.json");
        var fileContent = await File.ReadAllTextAsync(filePath);
        var deserializedRecord = JsonSerializer.Deserialize<LinerCode>(fileContent, FileStore.JsonOptions);
        deserializedRecord.Should().BeEquivalentTo(record);

        // Cleanup
        File.Delete(filePath);
    }

    [Fact]
    public async Task WriteAllAsync_ShouldCreateFiles_WhenCalled()
    {
        // Arrange
        var outputDirectory = Directory.GetCurrentDirectory();
        var records = _fixture
            .CreateMany<LinerCode>(3)
            .ToList();
        var codes = records
            .Select(obj => (Data: obj, FilePath: Path.Combine(outputDirectory, $"{obj.LinerSmdgCode.ToLower()}.json")))
            .ToList();

        // Act
        await _fileStore.WriteAllAsync(records, outputDirectory, r => r.LinerSmdgCode);

        // Assert
        foreach (var code in codes)
        {
            var fileContent = await File.ReadAllTextAsync(code.FilePath);
            var deserializedRecord = JsonSerializer.Deserialize<LinerCode>(fileContent, FileStore.JsonOptions);
            deserializedRecord.Should().BeEquivalentTo(code.Data);
        }

        // Cleanup
        foreach (var code in codes)
        {
            File.Delete(code.FilePath);
        }
    }
}