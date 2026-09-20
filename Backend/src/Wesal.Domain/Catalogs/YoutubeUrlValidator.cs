using System.Text.RegularExpressions;

namespace Wesal.Domain.Catalogs;

/// <summary>
/// Validation helper for the optional YouTube URL provided by hall owners (US-HALL).
/// Accepts the standard shareable/watch/shorts/embed YouTube link forms including the
/// query-string video id; rejects any other domain or a bare text fragment.
/// </summary>
public static partial class YoutubeUrlValidator
{
    public const int MaxLength = 500;

    [GeneratedRegex(
        @"^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{6,30}(?:\?[^\s#]*)?(?:#[^\s]*)?$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex YoutubeRegex();

    public static bool IsValid(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= MaxLength && YoutubeRegex().IsMatch(trimmed);
    }
}