using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.Auth;

namespace Wesal.Infrastructure.CurrentUser;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string? UserId => _httpContextAccessor.HttpContext?.User.FindFirstValue(ApplicationClaimTypes.UserId);

    public string? UserName => _httpContextAccessor.HttpContext?.User.FindFirstValue(ApplicationClaimTypes.UserName);

    public string? Email => _httpContextAccessor.HttpContext?.User.FindFirstValue(ApplicationClaimTypes.Email);

    public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public IReadOnlyList<string> Roles =>
        _httpContextAccessor.HttpContext?.User.FindAll(ApplicationClaimTypes.Role).Select(c => c.Value).ToArray() ?? [];
}
