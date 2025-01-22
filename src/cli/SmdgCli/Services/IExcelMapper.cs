namespace SmdgCli.Services;

public interface IExcelMapper<TResult>
{
    TResult Map(IDictionary<string, string> source);
    
    Dictionary<string, string> ReverseMap(TResult source);
}