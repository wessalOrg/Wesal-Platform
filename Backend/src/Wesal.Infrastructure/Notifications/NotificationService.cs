using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Notifications;

/// <summary>
/// Renders notifications in the recipient's own stored language (WESAL-TASK-13, Edit 13).
/// </summary>
/// <remarks>
/// <para>
/// The recipient's preference is read from <see cref="ApplicationUser.PreferredLanguage"/>,
/// the same field the <c>GET</c>/<c>PUT /api/v1/language</c> endpoints already maintain, so
/// there is one source of truth for "what language is this user browsing in" and no second
/// preference to keep in sync.
/// </para>
/// <para>
/// Crucially this reads the RECIPIENT's row, not the caller. An English-speaking owner
/// approving a booking does not decide that the Arabic-speaking requester's approval notice
/// is written in English; each side is notified in its own language.
/// </para>
/// <para>
/// If the recipient row cannot be read at all, this falls back to
/// <see cref="SupportedLanguages.Default"/> (Arabic, the platform's primary market) rather
/// than throwing, because a missing language preference must never stop a booking from being
/// approved or a notice from being delivered.
/// </para>
/// </remarks>
public sealed class NotificationService : INotificationService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public NotificationService(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<NotificationContent> BuildAsync(
        NotificationKind kind,
        string recipientUserId,
        IReadOnlyDictionary<string, string?>? values = null,
        string? targetId = null,
        CancellationToken cancellationToken = default)
    {
        var language = await ResolveRecipientLanguageAsync(recipientUserId, cancellationToken);

        return NotificationCatalog.Render(kind, language, values, targetId);
    }

    private async Task<Language> ResolveRecipientLanguageAsync(
        string recipientUserId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(recipientUserId))
        {
            return SupportedLanguages.ToLanguage(SupportedLanguages.Default);
        }

        var user = await _userManager.FindByIdAsync(recipientUserId);

        if (user is null)
        {
            return SupportedLanguages.ToLanguage(SupportedLanguages.Default);
        }

        // A stored value that somehow falls outside the enum must not throw at send time;
        // an unmapped value degrades to the platform default instead.
        return Enum.IsDefined(user.PreferredLanguage)
            ? user.PreferredLanguage
            : SupportedLanguages.ToLanguage(SupportedLanguages.Default);
    }
}
