namespace SmdgCli.Schemas.Liners.Conversion;

using System.Text.RegularExpressions;
using Services;

public partial class LinerCodeMapper : IMapper<LinerCode, LinerCodeExcel, LinerCodeChangeExcel>
{
    public (LinerCodeExcel Source, IEnumerable<LinerCodeChangeExcel> SourceChanges) ReverseMap(LinerCode result)
    {
        var source = new LinerCodeExcel
        {
            Code = result.LinerSmdgCode,
            Line = result.LinerName,
            Vocc = result.CarrierType == CarrierType.VOCC,
            Nvocc = result.CarrierType == CarrierType.NVOCC,
            ParentCompany = result.ParentCompany,
            IsActive = result.IsActive,
            ValidFrom = result.ValidFrom,
            ValidUntil = result.ValidTo,
            Website = result.Website,
            Remarks = result.Remarks,
            UnLocationCode = result.AddressLocation.UnLocode,
            UnCountryCode = result.AddressLocation.UnCountryCode,
            Address = result.UnstructuredAddress,
            Street = result.AddressLocation.Address?.Street,
            StreetNumber = result.AddressLocation.Address?.StreetNumber,
            Floor = result.AddressLocation.Address?.Floor,
            ZipCode = result.AddressLocation.Address?.PostCode,
            City = result.AddressLocation.Address?.City,
            StateRegion = result.AddressLocation.Address?.State,
            Country = result.AddressLocation.Address?.Country,
        };

        var sourceChanges = result.ChangeLogs
            .Select(c => new LinerCodeChangeExcel
            {
                LastUpdate = c.LastUpdateDate,
                LinerCode = result.LinerSmdgCode,
                Action = c.ActionCode.ToString(),
                Company = result.ParentCompany ?? "SMDG",
                Reason = c.Reason,
                Comments = c.Comments,
            });

        return (source, sourceChanges);
    }

    public LinerCode Map(LinerCodeExcel source, IEnumerable<LinerCodeChangeExcel>? sourceChanges)
    {
        var changesList = sourceChanges?.ToList() ?? [];
        if (changesList.Count == 0 || changesList.All(c => c.Action != "added"))
        {
            changesList.Add(new LinerCodeChangeExcel
            {
                LastUpdate = new DateOnly(2021, 01, 01),
                LinerCode = source.Code,
                Action = "added",
                Company = source.ParentCompany ?? "SMDG",
                Reason = "initial change",
                Comments = "Added by SMDG without a specific request.",
            });
        }

        var versionedChanges = changesList
            .OrderBy(c => c.LastUpdate)
            .Select((c,i) => (Version: $"V{i + 1}", Change: c))
            .ToList();

        var changeLogs = versionedChanges
            .Select(c => new ChangeLog
            {
                ActionCode = GetActionCode(c.Change.Action),
                LinerCodeVersion = c.Version,
                LastUpdateDate = c.Change.LastUpdate,
                UpdateRequestedBy = FindRequester(c.Change.Comments),
                LinkedLinerCode = string.Empty,
                Reason = c.Change.Reason,
                Comments = c.Change.Comments,
            })
            .ToList();

        var validFrom = source.ValidFrom ?? DateOnly.MinValue;

        return new LinerCode
        {
            IsActive = source.IsActive,
            CodeStatus = GetCodeStatus(changeLogs.Last().ActionCode, source.ValidUntil),
            LinerCodeVersion = changeLogs.Last().LinerCodeVersion,
            LinerSmdgCode = source.Code!.ToUpper(),
            LinerName = source.Line,
            CarrierType = source.Vocc
                ? CarrierType.VOCC
                : source.Nvocc ? CarrierType.NVOCC : null,
            ParentCompany = source.ParentCompany,
            UnstructuredAddress = source.Address,
            AddressLocation = new AddressLocation
            {
                UnLocode = source.UnLocationCode,
                UnCountryCode = source.UnCountryCode,
                Address = new Address
                {
                    Street = source.Street,
                    StreetNumber = source.StreetNumber,
                    Floor = source.Floor,
                    PostCode = source.ZipCode,
                    City = source.City,
                    State = source.StateRegion,
                    Country = source.Country,
                },
            },
            Website = source.Website,
            Remarks = source.Remarks,
            ValidFrom = validFrom,
            ValidTo = source.ValidUntil,
            ChangeLogs = changeLogs,
        };
    }

    private static ActionCodeEnum GetActionCode(string action)
    {
        return action switch
        {
            "added" => ActionCodeEnum.Added,
            "marked for deletion" => ActionCodeEnum.Updated,
            "deleted" => ActionCodeEnum.Deleted,
            _ => ActionCodeEnum.Updated,
        };
    }
    
    private static CodeStatusEnum GetCodeStatus(ActionCodeEnum lastActionCode, DateOnly? validTo)
    {
        var codeStatus = lastActionCode switch
        {
            ActionCodeEnum.Added => CodeStatusEnum.Active,
            ActionCodeEnum.Deleted => CodeStatusEnum.Deleted,
            ActionCodeEnum.MarkedForDelete => CodeStatusEnum.MarkedForDeletion,
            _ => CodeStatusEnum.Active,
        };

        if (codeStatus == CodeStatusEnum.Active && validTo != null &&  validTo < DateOnly.FromDateTime(DateTime.Now))
        {
            codeStatus = CodeStatusEnum.Expired;
        }

        return codeStatus;
    }

    public static string? FindRequester(string? comments)
    {
        if (string.IsNullOrWhiteSpace(comments))
        {
            return null;
        }

        var match = RequestedByRegex().Match(comments);
        var requester = match.Success ? match.Groups[1].Value.Trim() : null;
        return requester;
    }

    [GeneratedRegex(@"requested by ([A-Za-z0-9\s-.&]+)[,|\(]?", RegexOptions.IgnoreCase, "en-DK")]
    private static partial Regex RequestedByRegex();
}