namespace SmdgCli.Test.Schemas.Liners.Conversion;

using AutoFixture;
using FluentAssertions;
using SmdgCli.Schemas.Liners;
using SmdgCli.Schemas.Liners.Conversion;
using Utilities;
using Xunit;

public class LinerCodeFormMapperTests
{
    private readonly LinerCodeFormMapper _mapper = new();
    private readonly Fixture _fixture = new();

    public LinerCodeFormMapperTests()
    {
        _fixture.Customizations.Add(new DateOnlySpecimenBuilder());
    }

    [Fact]
    public void MapAdd_ValidFormData_ShouldReturnExpectedLinerCode()
    {
        // Arrange
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.LinerCode, "LC123")
            .With(x => x.LinerName, "Test Liner")
            .With(x => x.ValidFrom, "2023-01-01")
            .With(x => x.ValidTo, (string?)null)
            .With(x => x.CarrierType, "VOCC")
            .Create();

        // Act
        var result = _mapper.MapAdd(formData);

        // Assert
        result.LinerSmdgCode.Should().Be("LC123");
        result.LinerName.Should().Be("Test Liner");
        result.ValidFrom.Should().Be(DateOnly.FromDateTime(DateTime.Parse("2023-01-01")));
        result.IsActive.Should().BeTrue();
        result.CodeStatus.Should().Be(CodeStatusEnum.Active);
    }

    [Fact]
    public void MapUpdate_ValidFormData_ShouldReturnUpdatedLinerCode()
    {
        // Arrange
        var existing = _fixture.Build<LinerCode>()
            .With(x => x.LinerCodeVersion, VersionUtils.FirstVersion())
            .Create();
        var formData = _fixture.Build<LinerCodeForm>()
            .With(x => x.ChangeType, "update")
            .With(x => x.LinerCode, "LC123")
            .With(x => x.LinerName, "Updated Liner")
            .With(x => x.ValidFrom, "2023-01-01")
            .With(x => x.ValidTo, (string?)null)
            .With(x => x.CarrierType, "VOCC")
            .Create();

        // Act
        var result = _mapper.MapUpdate(formData, existing);

        // Assert
        result.LinerSmdgCode.Should().Be("LC123");
        result.LinerName.Should().Be("Updated Liner");
        result.ValidFrom.Should().Be(DateOnly.FromDateTime(DateTime.Parse("2023-01-01")));
    }

    [Fact]
    public void MapDelete_ShouldThrowNotImplementedException()
    {
        // Arrange
        var formData = _fixture.Create<LinerCodeForm>();
        var existing = _fixture.Create<LinerCode>();

        // Act
        Action act = () => _mapper.MapDelete(formData, existing);

        // Assert
        act.Should().Throw<NotImplementedException>();
    }
}