namespace SmdgCli.Services;

public interface IExcelMapper<out TResult>
{
    TResult Map(IDictionary<string, string> source);
}