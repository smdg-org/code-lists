namespace SmdgCli.Services;

public record CodeDictionaries
{
    public required List<Dictionary<string, string>> Codes { get; set; }
    
    public required List<Dictionary<string, string>> Changes { get; set; }
}