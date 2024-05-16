namespace SmdgCli.Schemas.Liners;

using System.Text.RegularExpressions;
using Services;

public partial class LinerCodeMapper : IMapper<LinerCode, LinerCodeExcel, LinerCodeChangeExcel>
{
    public LinerCode Map(LinerCodeExcel source, IEnumerable<LinerCodeChangeExcel>? sourceChanges)
    {
        var changesList = sourceChanges?.ToList() ?? [];
        if (changesList.Count == 0 || changesList.All(c => c.Action != "added"))
        {
            changesList.Add(new LinerCodeChangeExcel
            {
                LastUpdate = new DateTime(2021, 01, 01),
                LinerCode = source.Code,
                Action = "added",
                Company = source.ParentCompany,
                Reason = "new request",
                Comments = string.Empty,
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
                LastUpdateDate = DateOnly.FromDateTime(c.Change.LastUpdate),
                UpdateRequestedBy = FindRequester(c.Change.Comments),
                LinkedLinerCode = string.Empty,
                Reason = c.Change.Reason,
                Comments = c.Change.Comments,
            })
            .ToList();

        var validFrom = DateOnly.FromDateTime(source.ValidFrom ?? DateTime.MinValue);
        var validTo = DateOnly.FromDateTime(source.ValidUntil ?? DateTime.MaxValue);

        return new LinerCode
        {
            CodeStatus = GetCodeStatus(changeLogs.Last().ActionCode, validTo),
            SmdgLinerId = source.Code.ToLower(),
            LinerCodeVersion = changeLogs.Last().LinerCodeVersion,
            LinerSmdgCode = source.Code,
            LinerName = source.Line,
            ParentCompanyCode = string.Empty,
            ParentCompanyName = source.ParentCompany,
            CarrierType = string.Empty,
            ValidFrom = validFrom,
            ValidTo = validTo,
            Website = source.Website,
            Remarks = source.Remarks,
            ChangeLogs = changeLogs,
            AddressLocation = new AddressLocation
            {
                UnLocationCode = string.Empty,
                LocationName = string.Empty,
                Address = new Address
                {
                    Name = source.Address,
                    Street = string.Empty,
                    StreetNumber = string.Empty,
                    Floor = string.Empty,
                    PostCode = string.Empty,
                    City = string.Empty,
                    StateRegion = string.Empty,
                    Country = string.Empty,
                },
            },
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
    
    private static CodeStatusEnum GetCodeStatus(ActionCodeEnum lastActionCode, DateOnly validTo)
    {
        var codeStatus = lastActionCode switch
        {
            ActionCodeEnum.Added => CodeStatusEnum.Active,
            ActionCodeEnum.Deleted => CodeStatusEnum.Deleted,
            ActionCodeEnum.MarkedForDelete => CodeStatusEnum.MarkedForDeletion,
            _ => CodeStatusEnum.Active,
        };

        if (codeStatus == CodeStatusEnum.Active && validTo < DateOnly.FromDateTime(DateTime.Now))
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