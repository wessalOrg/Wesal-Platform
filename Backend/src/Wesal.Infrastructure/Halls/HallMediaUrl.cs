namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Single place for hall media URL rules (Edits 17/18/29). The API stores and serves
/// hall images as API-relative URLs (<c>/uploads/halls/{hallId}/{fileName}</c>) from
/// the <c>/uploads</c> static-file mount; clients prefix them with the API origin.
/// Two failure modes broke that contract and are closed here rather than rebuilt:
/// <list type="bullet">
/// <item>Owner edits echoed back absolute URLs (the edit form resolves covers to an
/// absolute display URL), which were persisted verbatim. Every environment move then
/// broke every stored image at once ("تعذر تحميل الصورة" / NOT_FOUND on listings,
/// featured cards, details and the admin review surface).</item>
/// <item>Halls whose cover (<c>MainImageUrl</c>) is blank while the gallery holds
/// photos exposed a null cover on every card endpoint.</item>
/// </list>
/// </summary>
public static class HallMediaUrl
{
    private const string UploadsPrefix = "/uploads/";

    /// <summary>
    /// Normalizes a client-supplied persisted media URL before it is stored. API-relative
    /// <c>/uploads/...</c> URLs pass through untouched. An absolute http(s) URL whose
    /// path is an <c>/uploads/...</c> API path is reduced to that relative path (plus any
    /// query), so a stored reference never pins the deployment's origin. Genuinely
    /// external URLs (CDN, other hosts/paths) and plain relative values are kept as-is.
    /// Blank input normalizes to <c>null</c>.
    /// </summary>
    public static string? NormalizePersistedUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        var trimmed = url.Trim();

        if (trimmed.StartsWith(UploadsPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var absolute)
            && (absolute.Scheme == Uri.UriSchemeHttp || absolute.Scheme == Uri.UriSchemeHttps)
            && absolute.AbsolutePath.StartsWith(UploadsPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return absolute.AbsolutePath + absolute.Query;
        }

        return trimmed;
    }

    /// <summary>
    /// Resolves the cover image for a hall card/detail: the stored cover when present,
    /// otherwise the first gallery URL. Returns <c>null</c> only when neither exists,
    /// so callers never throw on a missing image and simply report "no cover".
    /// </summary>
    public static string? ResolveCoverUrl(string? mainImageUrl, IEnumerable<string?>? galleryUrls)
    {
        if (!string.IsNullOrWhiteSpace(mainImageUrl))
        {
            return mainImageUrl;
        }

        if (galleryUrls is null)
        {
            return null;
        }

        foreach (var candidate in galleryUrls)
        {
            if (!string.IsNullOrWhiteSpace(candidate))
            {
                return candidate;
            }
        }

        return null;
    }
}
