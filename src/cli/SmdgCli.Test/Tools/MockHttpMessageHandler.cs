namespace SmdgCli.Test.Tools;

public class MockHttpMessageHandler : HttpMessageHandler
{
    private Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _whenSendAsync;

    public void WhenSendAsync(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> whenSendAsync)
    {
        _whenSendAsync = whenSendAsync;
    }
    
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        return _whenSendAsync(request, cancellationToken);
    }
}