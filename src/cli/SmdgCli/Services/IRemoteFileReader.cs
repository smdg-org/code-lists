namespace SmdgCli.Infrastructure;

public interface IRemoteFileReader
{
    Task<Stream> GetFile(string fileName, string remoteAddress);
}