namespace SmdgCli.Schemas.Liners.Conversion;

using Utilities;

public class LinerCodeFormMapper
{
    public LinerCode MapAdd(LinerCodeForm formData)
    {
        var version = VersionUtils.FirstVersion();

        var initialChange = new ChangeLog
        {
            ActionCode = ActionCodeEnum.Added,
            LinerCodeVersion = VersionUtils.FirstVersion(),
            LastUpdateDate = DateOnly.FromDateTime(DateTime.Now),
            UpdateRequestedBy = formData.Requester,
            LinkedLinerCode = formData.LinkedLinerCode,
            Reason = formData.ChangeReason ?? "initial request via application form",
            Comments = formData.ChangeComments
        };
    
        return new LinerCode()
        {
            IsActive = true,
            CodeStatus = CodeStatusEnum.Active,
            LinerCodeVersion = version,
            LinerSmdgCode = formData.LinerCode!.ToUpper(),
            LinerName = formData.LinerName!,
            CarrierType = formData.CarrierType is not null
                ? Enum.Parse<CarrierType>(formData.CarrierType)
                : null,
            ParentCompany = formData.ParentCompany,
            UnstructuredAddress = formData.UnstructuredAddress ?? string.Empty,
            AddressLocation = new AddressLocation
            {
                UnLocode = formData.UnLoCode,
                UnCountryCode = formData.UnCountryCode,
                Address = new Address
                {
                    Street = formData.Street,
                    StreetNumber = formData.StreetNumber,
                    Floor = formData.Floor,
                    PostCode = formData.PostalCode,
                    City = formData.City,
                    State = formData.State,
                    Country = formData.Country,
                },
            },
            Website = formData.Website ?? string.Empty,
            Remarks = formData.Remarks ?? string.Empty,
            ValidFrom = DateOnly.Parse(formData.ValidFrom!),
            ValidTo = formData.ValidTo is not null ? DateOnly.Parse(formData.ValidTo) : null,
            ChangeLogs = [initialChange],
        };
    }

    public LinerCode MapUpdate(LinerCodeForm formData, LinerCode existing)
    {
        var changeType = formData.ChangeType?.ToLower() ?? "update";
        
        var validFrom = !string.IsNullOrWhiteSpace(formData.ValidFrom)
             ? DateOnly.FromDateTime(DateTime.Parse(formData.ValidFrom))
            : existing.ValidFrom;
        
        var validTo = !string.IsNullOrWhiteSpace(formData.ValidTo)
            ? DateOnly.FromDateTime(DateTime.Parse(formData.ValidTo))
            : existing.ValidTo;
        
        var status = GetCodeStatus(changeType, validTo);
        
        var changeLogs = existing.ChangeLogs
            .OrderBy(c => c.LastUpdateDate)
            .ToList();

        var requestedChange = new ChangeLog
        {
            ActionCode = GetActionCode(changeType),
            LinerCodeVersion = VersionUtils.NextVersion(existing.LinerCodeVersion),
            LastUpdateDate = DateOnly.FromDateTime(DateTime.Now),
            UpdateRequestedBy = formData.Requester,
            Reason = formData.ChangeReason ?? "update request via application form",
            ChangedFields = [], // TODO: implement this
            LinkedLinerCode = formData.LinkedLinerCode,
            Comments = formData.ChangeComments,
        };

        changeLogs.Add(requestedChange);

        return new LinerCode
        {
            IsActive = (status == CodeStatusEnum.Active),
            CodeStatus = status,
            LinerCodeVersion = changeLogs.Last().LinerCodeVersion,
            LinerSmdgCode = formData.LinerCode!.ToUpper(),
            LinerName = formData.LinerName ?? existing.LinerName,
            CarrierType = formData.CarrierType is not null
                ? Enum.Parse<CarrierType>(formData.CarrierType)
                : existing.CarrierType,
            ParentCompany = formData.ParentCompany ?? existing.ParentCompany,
            UnstructuredAddress = formData.UnstructuredAddress ?? existing.UnstructuredAddress,
            AddressLocation = new AddressLocation
            {
                UnLocode = formData.UnLoCode ?? existing.AddressLocation.UnLocode,
                UnCountryCode = formData.UnCountryCode ?? existing.AddressLocation.UnCountryCode,
                Address = new Address
                {
                    Street = formData.Street ?? existing.AddressLocation.Address?.Street,
                    StreetNumber = formData.StreetNumber ?? existing.AddressLocation.Address?.StreetNumber,
                    Floor = formData.Floor ?? existing.AddressLocation.Address?.Floor,
                    PostCode = formData.PostalCode ?? existing.AddressLocation.Address?.PostCode,
                    City = formData.City ?? existing.AddressLocation.Address?.City,
                    State = formData.State ?? existing.AddressLocation.Address?.State,
                    Country = formData.Country ?? existing.AddressLocation.Address?.Country,
                },
            },
            Website = formData.Website ?? existing.Website,
            Remarks = formData.ChangeComments ?? existing.Remarks,
            ValidFrom = validFrom,
            ValidTo = validTo,
            ChangeLogs = changeLogs,
        };
    }

    public LinerCode MapDelete(LinerCodeForm formData, LinerCode existing)
    {
        throw new NotImplementedException();
    }
    
    private static CodeStatusEnum GetCodeStatus(string changeType, DateOnly? validTo)
    {
        if (validTo != null && validTo <= DateOnly.FromDateTime(DateTime.Now))
        {
            return CodeStatusEnum.Expired;
        }

        return changeType switch
        {
            "add" => CodeStatusEnum.Active,
            "update" => CodeStatusEnum.Active,
            "delete" => CodeStatusEnum.MarkedForDeletion,
            _ => throw new ArgumentException("changeType is not valid."),
        };
    }
    
    private static ActionCodeEnum GetActionCode(string changeType)
    {
        return changeType switch
        {
            "add" => ActionCodeEnum.Added,
            "update" => ActionCodeEnum.Updated,
            "delete" => ActionCodeEnum.MarkedForDelete,
            _ => throw new ArgumentException("changeType is not valid."),
        };
    }
}