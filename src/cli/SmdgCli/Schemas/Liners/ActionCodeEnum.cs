namespace SmdgCli.Schemas.Liners;

using System.Runtime.Serialization;

public enum ActionCodeEnum
{
    [EnumMember(Value = "ADDED")]
    Added = 1,

    [EnumMember(Value = "UPDATED")]
    Updated = 2,

    [EnumMember(Value = "MARKED FOR DELETION")]
    MarkedForDelete = 3,

    [EnumMember(Value = "DELETED")]
    Deleted = 4,
}

