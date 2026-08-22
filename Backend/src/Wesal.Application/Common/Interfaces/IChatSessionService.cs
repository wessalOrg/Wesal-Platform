using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IChatSessionService
{
    Task<AiSessionResponse> InitializeSessionAsync(string? language, CancellationToken cancellationToken = default);

    Task<AiSessionResponse?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default);
}
