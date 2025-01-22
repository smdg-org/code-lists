namespace SmdgCli.Services;

public interface IRemoteFileReader
{
    Task DownloadFile(string filePath, string remoteAddress);
}