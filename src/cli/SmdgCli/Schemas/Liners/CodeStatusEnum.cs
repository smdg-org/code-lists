namespace SmdgCli.Schemas.Liners;

using System.Runtime.Serialization;

public enum CodeStatusEnum
{
    [EnumMember(Value = "ACTIVE")]
    Active = 0,

    [EnumMember(Value = "EXPIRED")]
    Expired = 1,

    [EnumMember(Value = "DELETED")]
    Deleted = 2,

    [EnumMember(Value = "MARKED FOR DELETION")]
    MarkedForDeletion = 3
}