namespace SmdgCli.Services;

public interface IRemoteFileReader
{
    Task<Stream> GetFile(string fileName, string remoteAddress);
}