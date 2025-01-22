namespace SmdgCli.Services;

public interface IMapper<TResult, TSource, TChange>
{
    TResult Map(TSource source, IEnumerable<TChange> sourceChanges);
    
    (TSource Source, IEnumerable<TChange> SourceChanges) ReverseMap(TResult result);
}