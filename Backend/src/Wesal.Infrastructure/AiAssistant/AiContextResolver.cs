using Microsoft.Extensions.Logging;
using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Turns the UNTRUSTED client context (pathname + pinned entity) into a trusted
/// <see cref="AiTurnContext"/>. The pathname is validated against the navigation
/// registry, entity ids must be valid GUIDs, and the hall is always re-fetched from
/// <see cref="IHallDetailsService"/> (public/approved halls only) — client-supplied
/// names, prices, capacities or availability are never read. Context only improves
/// understanding; it grants no authorization and carries no private data.
///
/// Precedence for "which hall does the user mean": an ordinal reference to the last
/// shown results ("الثانية") &gt; the explicitly pinned hall &gt; the hall of the current
/// page &gt; the hall the conversation last focused (only for hall data questions).
/// An explicitly typed hall name always wins over all of these (the caller checks).
/// </summary>
public sealed class AiContextResolver
{
    private readonly IHallDetailsService _hallDetailsService;
    private readonly AiClock _clock;
    private readonly ILogger<AiContextResolver> _logger;

    public AiContextResolver(
        IHallDetailsService hallDetailsService,
        AiClock clock,
        ILogger<AiContextResolver> logger)
    {
        _hallDetailsService = hallDetailsService;
        _clock = clock;
        _logger = logger;
    }

    public async Task<AiTurnContext> ResolveAsync(
        AiRequestContext? request,
        AiConversationContext? conversation,
        string message,
        CancellationToken cancellationToken)
    {
        var today = _clock.Today();
        string? pageKey = null;
        string? pagePath = null;
        Guid? pageEntity = null;

        if (WesalNavigationRegistry.TryMatchPath(request?.Page?.Pathname, out var page, out var entityFromPath) && page is not null)
        {
            pageKey = page.Key;
            pagePath = page.IsDynamic ? null : page.Path;
            pageEntity = entityFromPath;
        }

        Guid? pinned = null;
        if (request?.Entity is { } entity
            && string.Equals(entity.Type?.Trim(), "hall", StringComparison.OrdinalIgnoreCase)
            && Guid.TryParse(entity.Id?.Trim(), out var pinnedId)
            && pinnedId != Guid.Empty)
        {
            pinned = pinnedId;
        }

        Guid? candidate = null;
        string? source = null;

        var ordinal = AiReferenceResolver.TryGetOrdinal(message);
        if (ordinal is { } index && conversation?.LastHalls is { Count: > 0 } shown)
        {
            var slot = index < 0 ? shown.Count - 1 : index;
            if (slot >= 0 && slot < shown.Count)
            {
                candidate = shown[slot].HallId;
                source = "ordinal";
            }
        }

        if (candidate is null && pinned is { } pin)
        {
            candidate = pin;
            source = "pinned";
        }

        if (candidate is null && pageEntity is { } pageHall)
        {
            candidate = pageHall;
            source = "page";
        }

        if (candidate is null
            && conversation?.LastHall is { } last
            && AiHallQuestionClassifier.Classify(message) is not AiHallQuestion.None
            && !AiHallQuestionClassifier.MentionsPlatform(message))
        {
            candidate = last.HallId;
            source = "conversation";
        }

        HallDetailsDto? hall = null;
        if (candidate is { } hallId)
        {
            hall = await TryGetHallAsync(hallId, cancellationToken);
            if (hall is null)
            {
                source = null;
            }
        }

        return new AiTurnContext(pageKey, pagePath, hall, source, today, _clock.TimeZoneLabel);
    }

    private async Task<HallDetailsDto?> TryGetHallAsync(Guid hallId, CancellationToken cancellationToken)
    {
        try
        {
            return await _hallDetailsService.GetHallDetailsAsync(hallId, cancellationToken);
        }
        catch (NotFoundException)
        {
            _logger.LogInformation("Assistant context hall {HallId} is not publicly available; context dropped.", hallId);
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(
                "Assistant context hall lookup failed; context dropped. exceptionType={ExceptionType}",
                ex.GetType().Name);
            return null;
        }
    }
}
