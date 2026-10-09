using System.Net;
using System.Net.Sockets;
using System.Text;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Loopback HTTP endpoint for exercising the official Google SDK without calling
/// Google or requiring a credential. The SDK's configured BaseUrl points here.
/// </summary>
internal sealed class GeminiSdkTestServer
{
    private readonly HttpListener _listener = new();
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
    private readonly Task _worker;

    public string BaseUrl { get; }

    public GeminiSdkTestServer(Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        _responder = responder;
        var port = GetEphemeralPort();
        var root = $"http://127.0.0.1:{port}/";
        BaseUrl = $"{root}v1beta";
        _listener.Prefixes.Add(root);
        _listener.Start();
        _worker = RunAsync();
    }

    private static int GetEphemeralPort()
    {
        using var socket = new TcpListener(IPAddress.Loopback, 0);
        socket.Start();
        return ((IPEndPoint)socket.LocalEndpoint).Port;
    }

    private async Task RunAsync()
    {
        try
        {
            while (_listener.IsListening)
            {
                HttpListenerContext context;
                try
                {
                    // The endpoint closes shortly after the last call so tests
                    // that intentionally make no request do not leak listeners.
                    context = await _listener.GetContextAsync().WaitAsync(TimeSpan.FromSeconds(2));
                }
                catch (TimeoutException)
                {
                    break;
                }
                catch (HttpListenerException)
                {
                    break;
                }

                await RespondAsync(context);
            }
        }
        finally
        {
            if (_listener.IsListening)
                _listener.Stop();
            _listener.Close();
        }
    }

    private async Task RespondAsync(HttpListenerContext context)
    {
        using var request = new HttpRequestMessage(new HttpMethod(context.Request.HttpMethod), context.Request.Url);
        using var requestReader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding);
        var body = await requestReader.ReadToEndAsync();
        if (!string.IsNullOrEmpty(body))
            request.Content = new StringContent(body, Encoding.UTF8, context.Request.ContentType?.Split(';')[0] ?? "application/json");

        foreach (var header in context.Request.Headers.AllKeys)
        {
            if (header is null)
                continue;
            request.Headers.TryAddWithoutValidation(header, context.Request.Headers.GetValues(header) ?? []);
        }

        HttpResponseMessage response;
        try
        {
            response = _responder(request);
        }
        catch (TaskCanceledException)
        {
            response = new HttpResponseMessage(HttpStatusCode.GatewayTimeout);
        }
        catch (Exception)
        {
            response = new HttpResponseMessage(HttpStatusCode.InternalServerError);
        }

        using (response)
        {
            context.Response.StatusCode = (int)response.StatusCode;
            context.Response.ContentType = response.Content?.Headers.ContentType?.ToString() ?? "application/json";
            var content = response.Content is null ? [] : await response.Content.ReadAsByteArrayAsync();
            context.Response.ContentLength64 = content.Length;
            await context.Response.OutputStream.WriteAsync(content);
        }

        context.Response.Close();
    }
}
