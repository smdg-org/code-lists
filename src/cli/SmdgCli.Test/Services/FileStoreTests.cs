namespace SmdgCli.Test.Services;

using AutoFixture;
using FluentAssertions;
using SmdgCli.Services;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using SmdgCli.Schemas.Liners;
using Xunit;

public class FileStoreTests : IDisposable
{
    private readonly Fixture _fixture = new();
    private readonly FileStore _fileStore = new();
    private readonly string _outputDirectory = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());

    public FileStoreTests()
    {
        _fixture.Customizations.Add(new DateOnlySpecimenBuilder());
        Directory.CreateDirectory(_outputDirectory);
    }

    public void Dispose() => Directory.Delete(_outputDirectory, true);

    [Fact]
    public async Task TryReadAsync_ShouldReturnDeserializedObject_WhenFileExists()
    {
        // Arrange
        var code = _fixture.Create<string>();
        var outputDirectory = _outputDirectory;
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
        var result = await _fileStore.TryReadAsync<LinerCode>(code, _outputDirectory);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task ReadAllAsync_ShouldReturnDeserializedObjects_WhenFilesExist()
    {
        // Arrange
        var outputDirectory = _outputDirectory;
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
        var outputDirectory = _outputDirectory;
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
        var outputDirectory = _outputDirectory;
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

        var combined = await _fileStore.ReadAllAsync<LinerCode>(outputDirectory);
        combined.Should().BeEquivalentTo(records);

        // Cleanup
        foreach (var code in codes)
        {
            File.Delete(code.FilePath);
        }
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task UpsertSingleAsync_ShouldKeepCombinedInSync_WhenAddingOrUpdating(bool updateExisting)
    {
        var existing = _fixture.Build<LinerCode>().With(x => x.LinerSmdgCode, "ZZZ").Create();
        var unchanged = _fixture.Build<LinerCode>().With(x => x.LinerSmdgCode, "MMM").Create();
        await _fileStore.WriteAllAsync([existing, unchanged], _outputDirectory, x => x.LinerSmdgCode);
        var updated = existing with
        {
            LinerSmdgCode = updateExisting ? existing.LinerSmdgCode : "AAA",
            LinerName = "Updated liner name",
            LinerCodeVersion = "V2"
        };

        await _fileStore.UpsertSingleAsync(updated.LinerSmdgCode, updated, _outputDirectory);

        var combined = (await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory)).ToList();
        var individual = await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory, false);
        combined.Should().BeEquivalentTo(individual, options => options.WithStrictOrdering());
        combined.Should().HaveCount(updateExisting ? 2 : 3);
        combined.Should().ContainEquivalentOf(updated);
        combined.Should().ContainEquivalentOf(unchanged);
        combined.Select(x => x.LinerSmdgCode).Should().OnlyHaveUniqueItems().And.BeInAscendingOrder();
    }

    [Fact]
    public async Task UpsertSingleAsync_ShouldRebuildFromIndividualFiles_WhenCombinedIsMissing()
    {
        var records = _fixture.CreateMany<LinerCode>(2).ToList();
        await _fileStore.WriteAllAsync(records, _outputDirectory, x => x.LinerSmdgCode);
        File.Delete(Path.Combine(_outputDirectory, FileStore.CombinedFileName));
        var updated = records[0] with { LinerName = "Updated liner name" };

        await _fileStore.UpsertSingleAsync(updated.LinerSmdgCode, updated, _outputDirectory);

        var combined = await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory);
        combined.Should().BeEquivalentTo(new[] { updated, records[1] });
    }

    [Fact]
    public async Task RebuildCombined_ShouldRepairStaleData_AndBeIdempotent()
    {
        var records = _fixture.CreateMany<LinerCode>(3).ToList();
        await _fileStore.WriteAllAsync(records, _outputDirectory, x => x.LinerSmdgCode);
        var combinedPath = Path.Combine(_outputDirectory, FileStore.CombinedFileName);
        await File.WriteAllTextAsync(combinedPath, "[]");

        await _fileStore.RebuildCombined<LinerCode>(_outputDirectory, default);

        var combined = await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory);
        combined.Should().BeEquivalentTo(records);
        var firstBuild = await File.ReadAllTextAsync(combinedPath);
        await _fileStore.RebuildCombined<LinerCode>(_outputDirectory, default);
        (await File.ReadAllTextAsync(combinedPath)).Should().Be(firstBuild);
    }

    [Fact]
    public async Task WriteAllAsync_ShouldMatchRebuiltCombined_WhenInputIsNotSorted()
    {
        var records = new[] { "ZZZ", "AAA", "MMM" }
            .Select(code => _fixture.Build<LinerCode>().With(x => x.LinerSmdgCode, code).Create())
            .ToList();

        await _fileStore.WriteAllAsync(records, _outputDirectory, x => x.LinerSmdgCode);

        var combinedPath = Path.Combine(_outputDirectory, FileStore.CombinedFileName);
        var written = await File.ReadAllTextAsync(combinedPath);
        var combined = await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory);
        var individual = await _fileStore.ReadAllAsync<LinerCode>(_outputDirectory, false);
        combined.Should().BeEquivalentTo(individual, options => options.WithStrictOrdering());
        await _fileStore.RebuildCombined<LinerCode>(_outputDirectory, default);
        (await File.ReadAllTextAsync(combinedPath)).Should().Be(written);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RebuildCombined_ShouldFailWithoutReplacingCombined_WhenIndexedFileIsMissingOrInvalid(bool invalidJson)
    {
        var record = _fixture.Build<LinerCode>().With(x => x.LinerSmdgCode, "AAA").Create();
        await _fileStore.WriteAllAsync([record], _outputDirectory, x => x.LinerSmdgCode);
        var combinedPath = Path.Combine(_outputDirectory, FileStore.CombinedFileName);
        var originalCombined = await File.ReadAllTextAsync(combinedPath);
        var individualPath = Path.Combine(_outputDirectory, "aaa.json");
        if (invalidJson)
        {
            await File.WriteAllTextAsync(individualPath, "{");
        }
        else
        {
            File.Delete(individualPath);
        }

        Func<Task> rebuild = () => _fileStore.RebuildCombined<LinerCode>(_outputDirectory, default);

        if (invalidJson)
        {
            await rebuild.Should().ThrowAsync<JsonException>();
        }
        else
        {
            await rebuild.Should().ThrowAsync<FileNotFoundException>();
        }
        (await File.ReadAllTextAsync(combinedPath)).Should().Be(originalCombined);
    }
}