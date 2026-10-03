using Wesal.Application.Common.Models;

namespace Wesal.Application.Ai;

/// <summary>
/// Derives what a conversation should remember from an assistant response: the halls
/// that were shown (so "الثانية" resolves) and the single hall the turn focused on.
/// </summary>
public static class AiResponseMemory
{
    public static IReadOnlyList<AiHallRef> ShownHalls(AiAssistantResponse response)
        => response.Halls
            .Where(hall => hall.HallId != Guid.Empty)
            .Select(hall => new AiHallRef(hall.HallId, hall.HallName))
            .ToList();

    public static AiHallRef? FocusedHall(AiAssistantResponse response)
    {
        if (response.HallDetails is { HallId: var detailId } details && detailId != Guid.Empty)
        {
            return new AiHallRef(detailId, details.HallName);
        }

        if (response.Availability is { HallId: var availId } availability && availId != Guid.Empty)
        {
            return new AiHallRef(availId, availability.HallName);
        }

        return response.Halls.Count == 1
            ? new AiHallRef(response.Halls[0].HallId, response.Halls[0].HallName)
            : null;
    }
}
