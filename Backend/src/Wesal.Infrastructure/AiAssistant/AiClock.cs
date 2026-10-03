using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// The assistant's notion of "today": the application clock converted to the
/// configured business time zone (default Asia/Gaza), so "tomorrow" and weekdays are
/// resolved against the user's local calendar date rather than UTC.
/// </summary>
public sealed class AiClock
{
    private static readonly string[] GazaFallbackIds = ["Asia/Gaza", "Gaza Standard Time", "Asia/Hebron", "Israel Standard Time"];

    private readonly IDateTime _dateTime;
    private readonly TimeZoneInfo _zone;

    public AiClock(IDateTime dateTime, IOptions<GoogleAiSettings>? settings = null)
    {
        _dateTime = dateTime;
        var configured = settings?.Value.TimeZoneId;
        _zone = Resolve(configured);
        TimeZoneLabel = string.IsNullOrWhiteSpace(configured) ? "Asia/Gaza" : configured!;
    }

    public string TimeZoneLabel { get; }

    public DateOnly Today()
        => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(_dateTime.Now, _zone).DateTime);

    private static TimeZoneInfo Resolve(string? configured)
    {
        var candidates = string.IsNullOrWhiteSpace(configured)
            ? GazaFallbackIds
            : new[] { configured!.Trim() }.Concat(GazaFallbackIds).ToArray();

        foreach (var id in candidates)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone("Wesal", TimeSpan.FromHours(2), "Wesal", "Wesal");
    }
}
