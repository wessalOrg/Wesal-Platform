using System.Net;

namespace Wesal.Tests.Infrastructure;

public sealed class GeminiSdkTestServerShould
{
    [Fact]
    public async Task StartConcurrentEndpointsOnDistinctEphemeralPorts()
    {
        var servers = await Task.WhenAll(Enumerable.Range(0, 32)
            .Select(_ => Task.Run(() => new GeminiSdkTestServer(_ => new HttpResponseMessage(HttpStatusCode.OK)))));

        try
        {
            Assert.Equal(servers.Length, servers.Select(server => server.BaseUrl).Distinct(StringComparer.Ordinal).Count());
        }
        finally
        {
            await Task.WhenAll(servers.Select(server => server.DisposeAsync().AsTask()));
        }
    }
}
