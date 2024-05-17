namespace SmdgCli.Schemas.Liners;

using System.Runtime.Serialization;

public enum ActionCodeEnum
{
    [EnumMember(Value = "UPDATE")]
    Added = 1,

    [EnumMember(Value = "UPDATE")]
    Updated = 2,

    [EnumMember(Value = "MARKED FOR DELETION")]
    MarkedForDelete = 3,

    [EnumMember(Value = "DELETE")]
    Deleted = 4,
}

