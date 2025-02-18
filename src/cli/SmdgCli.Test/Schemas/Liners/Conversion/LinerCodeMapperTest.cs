namespace SmdgCli.Test.Schemas.Liners.Conversion;

using System;
using System.Collections.Generic;
using System.Linq;
using FluentAssertions;
using SmdgCli.Schemas.Liners;
using SmdgCli.Schemas.Liners.Conversion;
using Xunit;

public class LinerCodeMapperTest
{
    [Fact]
    public void ReverseMap_ShouldMapAllFieldsCorrectly()
    {
        // Arrange
        var mapper = new LinerCodeMapper();
    
        var linerCode = new LinerCode
        {
            CodeStatus = CodeStatusEnum.Active,
            LinerCodeVersion = "V1",
            LinerSmdgCode = "CODE",
            LinerName = "Liner Name",
            ParentCompany = "Parent Company",
            CarrierType = CarrierType.NVOCC,
            IsActive = true,
            ValidFrom = DateOnly.FromDateTime(DateTime.Now.AddDays(-10)),
            ValidTo = DateOnly.FromDateTime(DateTime.Now.AddDays(10)),
            Website = "http://example.com",
            Remarks = "Some remarks",
            UnstructuredAddress = "Unstructured Address",
            AddressLocation = new AddressLocation
            {
                UnLocode = "UNLOCODE",
                UnCountryCode = "UNCODE",
                Address = new Address
                {
                    Street = "Street",
                    StreetNumber = "123",
                    Floor = "1",
                    PostCode = "12345",
                    City = "City",
                    State = "State",
                    Country = "Country"
                }
            },
            ChangeLogs = new List<ChangeLog>
            {
                new ChangeLog
                {
                    LastUpdateDate = DateOnly.FromDateTime(DateTime.Now.AddDays(-5)),
                    ActionCode = ActionCodeEnum.Added,
                    Reason = "Initial reason",
                    LinerCodeVersion = "V1",
                    Comments = "Initial comments"
                }
            }
        };

        // Act
        var (source, sourceChanges) = mapper.ReverseMap(linerCode);

        // Assert
        source.Code.Should().Be(linerCode.LinerSmdgCode);
        source.Line.Should().Be(linerCode.LinerName);
        source.ParentCompany.Should().Be(linerCode.ParentCompany);
        source.Nvocc.Should().Be(linerCode.CarrierType == CarrierType.NVOCC);
        source.Vocc.Should().Be(linerCode.CarrierType == CarrierType.VOCC);
        source.IsActive.Should().Be(linerCode.IsActive);
        source.ValidFrom.Should().Be(linerCode.ValidFrom);
        source.ValidUntil.Should().Be(linerCode.ValidTo);
        source.Website.Should().Be(linerCode.Website);
        source.Remarks.Should().Be(linerCode.Remarks);
        source.UnLocationCode.Should().Be(linerCode.AddressLocation.UnLocode);
        source.UnCountryCode.Should().Be(linerCode.AddressLocation.UnCountryCode);
        source.Address.Should().Be(linerCode.UnstructuredAddress);
        source.Street.Should().Be(linerCode.AddressLocation.Address.Street);
        source.StreetNumber.Should().Be(linerCode.AddressLocation.Address.StreetNumber);
        source.Floor.Should().Be(linerCode.AddressLocation.Address.Floor);
        source.ZipCode.Should().Be(linerCode.AddressLocation.Address.PostCode);
        source.City.Should().Be(linerCode.AddressLocation.Address.City);
        source.StateRegion.Should().Be(linerCode.AddressLocation.Address.State);
        source.Country.Should().Be(linerCode.AddressLocation.Address.Country);

        var change = sourceChanges.First();
        change.LastUpdate.Should().Be(linerCode.ChangeLogs.First().LastUpdateDate);
        change.Action.Should().Be(linerCode.ChangeLogs.First().ActionCode.ToString());
        change.Reason.Should().Be(linerCode.ChangeLogs.First().Reason);
        change.Comments.Should().Be(linerCode.ChangeLogs.First().Comments);
    }

    [Fact]
    public void Map_ShouldMapAllFieldsCorrectly()
    {
        // Arrange
        var mapper = new LinerCodeMapper();

        var source = new LinerCodeExcel
        {
            Code = "CODE",
            Line = "Liner Name",
            ParentCompany = "Parent Company",
            Nvocc = true,
            Vocc = false,
            IsActive = true,
            ValidFrom = DateOnly.FromDateTime(DateTime.Now.AddDays(-10)),
            ValidUntil = DateOnly.FromDateTime(DateTime.Now.AddDays(10)),
            Website = "http://example.com",
            Remarks = "Some remarks",
            UnLocationCode = "UNLOCODE",
            UnCountryCode = "UNCODE",
            Address = "Unstructured Address",
            Street = "Street",
            StreetNumber = "123",
            Floor = "1",
            ZipCode = "12345",
            City = "City",
            StateRegion = "State",
            Country = "Country"
        };

        var sourceChanges = new List<LinerCodeChangeExcel>
        {
            new LinerCodeChangeExcel
            {
                LinerCode = source.Code,
                Company = source.ParentCompany,
                LastUpdate = DateOnly.FromDateTime(DateTime.Now.AddDays(-5)),
                Action = "added",
                Reason = "Initial reason",
                Comments = "Initial comments"
            }
        };

        // Act
        var result = mapper.Map(source, sourceChanges);

        // Assert
        result.LinerSmdgCode.Should().Be(source.Code.ToUpper());
        result.LinerName.Should().Be(source.Line);
        result.ParentCompany.Should().Be(source.ParentCompany);
        result.CarrierType.Should().Be(CarrierType.NVOCC);
        result.IsActive.Should().Be(source.IsActive);
        result.ValidFrom.Should().Be(source.ValidFrom);
        result.ValidTo.Should().Be(source.ValidUntil);
        result.Website.Should().Be(source.Website);
        result.Remarks.Should().Be(source.Remarks);
        result.AddressLocation.UnLocode.Should().Be(source.UnLocationCode);
        result.AddressLocation.UnCountryCode.Should().Be(source.UnCountryCode);
        result.UnstructuredAddress.Should().Be(source.Address);
        result.AddressLocation.Address.Should().NotBeNull();
        result.AddressLocation.Address!.Street.Should().Be(source.Street);
        result.AddressLocation.Address.StreetNumber.Should().Be(source.StreetNumber);
        result.AddressLocation.Address.Floor.Should().Be(source.Floor);
        result.AddressLocation.Address.PostCode.Should().Be(source.ZipCode);
        result.AddressLocation.Address.City.Should().Be(source.City);
        result.AddressLocation.Address.State.Should().Be(source.StateRegion);
        result.AddressLocation.Address.Country.Should().Be(source.Country);

        var change = result.ChangeLogs.First();
        change.LastUpdateDate.Should().Be(sourceChanges.First().LastUpdate);
        change.ActionCode.Should().Be(ActionCodeEnum.Added);
        change.Reason.Should().Be(sourceChanges.First().Reason);
        change.Comments.Should().Be(sourceChanges.First().Comments);
    }

    [Theory]
    [InlineData("requested by Some Company, other comments", "Some Company")]
    [InlineData("requested by Some Company (Code)", "Some Company")]
    [InlineData("requested by Company123", "Company123")]
    [InlineData("requested by A.A. Company", "A.A. Company")]
    [InlineData("requested by Hyphenated-Name LLC, other comments", "Hyphenated-Name LLC")]
    [InlineData("some random text", null)]
    public void FindRequester_ReturnsRequester(string comment, string? expected)
    {
        // Act
        var actual = LinerCodeMapper.FindRequester(comment);

        // Assert
        actual.Should().Be(expected);
    }
}