using System.Net;
using System.Net.Sockets;
using System.Text;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Loopback HTTP endpoint for exercising the official Google SDK without calling
/// Google or requiring a credential. The SDK's configured BaseUrl points here.
/// </summary>
internal sealed class GeminiSdkTestServer : IAsyncDisposable
{
    private static readonly object ListenerStartLock = new();
    private readonly HttpListener _listener;
    private readonly object _listenerLifecycleLock = new();
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
    private readonly Task _worker;
    private bool _listenerClosed;

    public string BaseUrl { get; }

    public GeminiSdkTestServer(Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        _responder = responder;
        (_listener, BaseUrl) = StartListener();
        _worker = RunAsync();
    }

    private static (HttpListener Listener, string BaseUrl) StartListener()
    {
        // Reserve the ephemeral port and register the HttpListener prefix under one
        // process-wide lock. Without this, parallel tests can both select the same port
        // during the gap between releasing TcpListener and starting HttpListener.
        lock (ListenerStartLock)
        {
            HttpListenerException? lastError = null;
            for (var attempt = 0; attempt < 8; attempt++)
            {
                var port = GetEphemeralPort();
                var root = $"http://127.0.0.1:{port}/";
                var listener = new HttpListener();
                listener.Prefixes.Add(root);
                try
                {
                    listener.Start();
                    return (listener, $"{root}v1beta");
                }
                catch (HttpListenerException exception)
                {
                    lastError = exception;
                    listener.Close();
                }
            }

            throw new HttpListenerException(lastError?.ErrorCode ?? 0,
                $"Could not start the Gemini test endpoint after several ephemeral-port attempts. {lastError?.Message}");
        }
    }

    private static int GetEphemeralPort()
    {
        using var socket = new TcpListener(IPAddress.Loopback, 0);
        socket.Start();
        return ((IPEndPoint)socket.LocalEndpoint).Port;
    }

    public async ValueTask DisposeAsync()
    {
        StopListener();
        await _worker;
    }

    private bool IsListenerListening
    {
        get
        {
            lock (_listenerLifecycleLock)
                return !_listenerClosed && _listener.IsListening;
        }
    }

    private bool IsListenerClosed
    {
        get
        {
            lock (_listenerLifecycleLock)
                return _listenerClosed;
        }
    }

    private void StopListener()
    {
        lock (_listenerLifecycleLock)
        {
            if (_listenerClosed)
                return;

            _listenerClosed = true;
            try
            {
                if (_listener.IsListening)
                    _listener.Stop();
            }
            finally
            {
                _listener.Close();
            }
        }
    }

    private async Task RunAsync()
    {
        try
        {
            while (IsListenerListening)
            {
                HttpListenerContext context;
                try
                {
                    // The endpoint closes shortly after the last call so tests
                    // that intentionally make no request do not leak listeners.
                    context = await _listener.GetContextAsync().WaitAsync(TimeSpan.FromSeconds(20));
                }
                catch (TimeoutException)
                {
                    break;
                }
                catch (HttpListenerException)
                {
                    break;
                }
                catch (ObjectDisposedException) when (IsListenerClosed)
                {
                    // On Linux, stopping a listener with a pending GetContextAsync can
                    // complete that wait with ObjectDisposedException instead of
                    // HttpListenerException. Disposal is the normal shutdown path.
                    break;
                }

                await RespondAsync(context);
            }
        }
        finally
        {
            StopListener();
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
