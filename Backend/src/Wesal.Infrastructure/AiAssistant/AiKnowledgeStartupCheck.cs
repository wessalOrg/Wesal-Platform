using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Forces the Knowledge Base to load at application start (it is otherwise created on
/// first use) so a build that shipped without the embedded articles is visible in the
/// startup log immediately: "Wesal AI knowledge loaded: N articles". Logs no user data.
/// </summary>
public sealed class AiKnowledgeStartupCheck : IHostedService
{
    private readonly IWesalKnowledgeService _knowledge;
    private readonly ILogger<AiKnowledgeStartupCheck> _logger;

    public AiKnowledgeStartupCheck(IWesalKnowledgeService knowledge, ILogger<AiKnowledgeStartupCheck> logger)
    {
        _knowledge = knowledge;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        // Resolving the singleton already logged the count; repeat the verdict at the
        // application level so an empty KB is an unmistakable startup warning.
        if (_knowledge is IWesalKnowledgeStats { ArticleCount: 0 })
        {
            _logger.LogWarning("Wesal AI knowledge is EMPTY at startup; official answers will not be available.");
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
