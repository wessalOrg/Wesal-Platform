using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Languages;

public sealed class LanguageService : ILanguageService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;

    public LanguageService(UserManager<ApplicationUser> userManager, ICurrentUserService currentUser)
    {
        _userManager = userManager;
        _currentUser = currentUser;
    }

    public async Task<LanguageResponse> GetLanguageAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        var user = await GetCurrentUserAsync(cancellationToken);

        return new LanguageResponse
        {
            Language = SupportedLanguages.ToCode(user.PreferredLanguage)
        };
    }

    public async Task<LanguageResponse> UpdateLanguageAsync(UpdateLanguageRequest request, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        var language = SupportedLanguages.ToLanguage(request.Language);

        var user = await GetCurrentUserAsync(cancellationToken);

        user.PreferredLanguage = language;

        var result = await _userManager.UpdateAsync(user);

        if (!result.Succeeded)
        {
            throw new BusinessRuleException(
                "LanguageUpdateFailed",
                "The language preference could not be saved.");
        }

        return new LanguageResponse
        {
            Language = SupportedLanguages.ToCode(language)
        };
    }

    private async Task<ApplicationUser> GetCurrentUserAsync(CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId;

        var user = await _userManager.FindByIdAsync(userId!);

        if (user is null)
        {
            throw new NotFoundException(nameof(ApplicationUser), userId!);
        }

        return user;
    }

    private void EnsureAuthenticated()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to manage your language preference.");
        }
    }
}