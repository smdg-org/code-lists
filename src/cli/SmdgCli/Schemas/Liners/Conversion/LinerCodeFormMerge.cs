namespace SmdgCli.Schemas.Liners.Conversion;

public class LinerCodeFormMerge
{
    public required LinerCodeForm FromData { get; set; }

    public LinerCode? ExistingData { get; set; }
}