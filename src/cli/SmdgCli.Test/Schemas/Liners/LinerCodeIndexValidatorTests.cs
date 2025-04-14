namespace SmdgCli.Test.Schemas.Liners;

using AutoFixture;
using FluentValidation.TestHelper;
using SmdgCli.Schemas.Liners;

public class LinerCodeIndexValidatorTests
{
    private readonly LinerCodeIndexValidator _validator = new();
    private readonly Fixture _fixture = new();

    public LinerCodeIndexValidatorTests()
    {
        _fixture.Customizations.Add(new DateOnlySpecimenBuilder());
    }

    [Fact]
    public void Validate_ValidLinerCodeIndex_ShouldNotHaveValidationErrors()
    {
        // Arrange
        var linerCodeIndex = _fixture
            .Build<LinerCodeIndex>()
            .With(x => x.LinerCodeFiles,
                _fixture
                    .CreateMany<string>()
                    .Select(c => c.Substring(0, 3) + ".json"))
            .Create();

        // Act
        var result = _validator.TestValidate(linerCodeIndex);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_NullLinerCodeFiles_ShouldHaveValidationError()
    {
        // Arrange
        var linerCodeIndex = _fixture.Build<LinerCodeIndex>()
            .With(x => x.LinerCodeFiles, (List<string>?)null)
            .Create();

        // Act
        var result = _validator.TestValidate(linerCodeIndex);

        // Assert
        result
            .ShouldHaveValidationErrorFor(x => x.LinerCodeFiles)
            .WithErrorMessage("The list of liner codes cannot be null.");
    }

    [Fact]
    public void Validate_EmptyLinerCodeFiles_ShouldHaveValidationError()
    {
        // Arrange
        var linerCodeIndex = _fixture.Build<LinerCodeIndex>()
            .With(x => x.LinerCodeFiles, new List<string>())
            .Create();

        // Act
        var result = _validator.TestValidate(linerCodeIndex);

        // Assert
        result
            .ShouldHaveValidationErrorFor(x => x.LinerCodeFiles)
            .WithErrorMessage("The list of liner codes cannot be empty.");
    }

    [Fact]
    public void Validate_LinerCodeFilesWithEmptyCode_ShouldHaveValidationError()
    {
        // Arrange
        var linerCodeIndex = _fixture.Build<LinerCodeIndex>()
            .With(x => x.LinerCodeFiles, new List<string> { string.Empty })
            .Create();

        // Act
        var result = _validator.TestValidate(linerCodeIndex);

        // Assert
        result
            .ShouldHaveValidationErrorFor(x => x.LinerCodeFiles)
            .WithErrorMessage("Liner code cannot be empty.");
    }

    [Fact]
    public void Validate_LinerCodeFilesWithTooLongCode_ShouldHaveValidationError()
    {
        // Arrange
        var linerCodeIndex = _fixture.Build<LinerCodeIndex>()
            .With(x => x.LinerCodeFiles, new List<string> { "1234.json" })
            .Create();

        // Act
        var result = _validator.TestValidate(linerCodeIndex);

        // Assert
        result
            .ShouldHaveValidationErrorFor(x => x.LinerCodeFiles)
            .WithErrorMessage("Liner code file name must be no more than 8 characters long.");
    }
}