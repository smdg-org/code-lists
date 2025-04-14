namespace SmdgCli.Test.Schemas.Liners;

using AutoFixture;
using FluentValidation.TestHelper;
using SmdgCli.Schemas.Liners;

public class LinerCodeValidatorTests
{
    private readonly LinerCodeValidator _validator = new();
    private readonly Fixture _fixture = new();

    public LinerCodeValidatorTests()
    {
        _fixture.Customizations.Add(new DateOnlySpecimenBuilder());
    }

    [Fact]
    public void Validate_ValidLinerCode_ShouldNotHaveValidationErrors()
    {
        // Arrange
        var linerCode = _fixture
            .Build<LinerCode>()
            .With(x => x.LinerCodeVersion, "V1")
            .With(x => x.LinerSmdgCode, "MSK")
            .Create();

        // Act
        var result = _validator.TestValidate(linerCode);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyLinerCodeVersion_ShouldHaveValidationError()
    {
        // Arrange
        var linerCode = _fixture.Build<LinerCode>()
            .With(x => x.LinerCodeVersion, string.Empty)
            .Create();

        // Act
        var result = _validator.TestValidate(linerCode);

        // Assert
        result
            .ShouldHaveValidationErrorFor(x => x.LinerCodeVersion)
            .WithErrorMessage("Liner Code Version is required");
    }

    [Fact]
    public void Validate_LinerCodeVersionTooLong_ShouldHaveValidationError()
    {
        // Arrange
        var linerCode = _fixture.Build<LinerCode>()
            .With(x => x.LinerCodeVersion, "1234")
            .Create();

        // Act
        var result = _validator.TestValidate(linerCode);

        // Assert
        result
            .ShouldHaveValidationErrorFor(x => x.LinerCodeVersion)
            .WithErrorMessage("Liner Code Version must be maximum 3 characters long");
    }
}