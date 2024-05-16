namespace SmdgCli.Services;

public interface IMapper<out TResult, in TSource, in TChange>
{
    TResult Map(TSource source, IEnumerable<TChange> sourceChanges);
}