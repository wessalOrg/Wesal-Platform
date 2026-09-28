using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface ISessionService
{
    /// <summary>
    /// The caller's session: authentication state, primary role, hall-owner flag and
    /// live hall-ownership flag (Edit 19). Ownership is counted from the database, so
    /// the response never reflects a client-supplied value.
    /// </summary>
    Task<SessionResponse> GetSessionAsync(CancellationToken cancellationToken = default);
}
