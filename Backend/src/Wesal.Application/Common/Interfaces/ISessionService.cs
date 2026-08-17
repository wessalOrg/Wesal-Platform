using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface ISessionService
{
    SessionResponse GetSession();
}
