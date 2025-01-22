namespace SmdgCli.Test.Schemas.Liners.Conversion;

using AutoFixture;
using FluentValidation.TestHelper;
using SmdgCli.Schemas.Liners.Conversion;
using Xunit;

public class LinerCodeFormValidatorTests
{
    private readonly LinerCodeFormValidator _validator = new();
    private readonly Fixture _fixture = new();

    [Fact]
    public void Validate_ValidLinerCodeForm_ShouldNotHaveValidationErrors()
    {
        // Arrange
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.ChangeType, "Add")
            .With(x => x.LinerCode, "ABC")
            .With(x => x.LinerName, "Test Liner")
            .Create();

        // Act
        var result = _validator.TestValidate(formData);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyChangeType_ShouldHaveValidationError()
    {
        // Arrange
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.ChangeType, string.Empty)
            .Create();

        // Act
        var result = _validator.TestValidate(formData);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ChangeType)
            .WithErrorMessage("Change Type is required.");
    }

    [Fact]
    public void Validate_EmptyLinerCode_ShouldHaveValidationError()
    {
        // Arrange
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.LinerCode, string.Empty)
            .Create();

        // Act
        var result = _validator.TestValidate(formData);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LinerCode)
            .WithErrorMessage("Liner Code is required");
    }

    [Fact]
    public void Validate_LinerCodeTooLong_ShouldHaveValidationError()
    {
        // Arrange
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.LinerCode, "ABCD")
            .Create();

        // Act
        var result = _validator.TestValidate(formData);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LinerCode)
            .WithErrorMessage("Liner Code must be 3 characters long.");
    }

    [Fact]
    public void Validate_EmptyLinerName_ShouldHaveValidationError()
    {
        // Arrange
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.LinerName, string.Empty)
            .Create();

        // Act
        var result = _validator.TestValidate(formData);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LinerName)
            .WithErrorMessage("Liner Name is required");
    }

    [Fact]
    public void Validate_LinerNameTooLong_ShouldHaveValidationError()
    {
        // Arrange
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.LinerName, new string('A', 101))
            .Create();

        // Act
        var result = _validator.TestValidate(formData);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LinerName)
            .WithErrorMessage("Liner Name must be 100 characters long.");
    }

    [Fact]
    public void Validate_ParentCompanyTooLong_ShouldHaveValidationError()
    {
        // Arrange
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.ParentCompany, new string('A', 101))
            .Create();

        // Act
        var result = _validator.TestValidate(formData);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ParentCompany)
            .WithErrorMessage("Parent Company Code must be 100 characters long.");
    }
}