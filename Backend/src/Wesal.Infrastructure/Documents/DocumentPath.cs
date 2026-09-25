namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Builds the relative URLs (the strings persisted on hall/user records) for protected
/// documents and resolves them back to absolute paths. Resolution always starts from the
/// persisted URL — never from a client-supplied path — and rejects any traversal attempt.
/// </summary>
public static class DocumentPath
{
    /// <summary>URL segment used for owner identity documents.</summary>
    private const string OwnersSegment = "owners";

    /// <summary>URL segment used for conversation message attachments.</summary>
    private const string ConversationsSegment = "conversations";

    public static string OwnerIdentityRelativeUrl(string ownerId, string fileName)
        => $"/documents/{OwnersSegment}/{ownerId}/{fileName}";

    /// <summary>
    /// Relative URL of a conversation message's image attachment (WESAL-TASK-4, Edit 4).
    /// </summary>
    public static string MessageAttachmentRelativeUrl(Guid conversationId, string fileName)
        => $"/documents/{ConversationsSegment}/{conversationId}/attachments/{fileName}";

    /// <summary>
    /// Resolves a persisted relative URL to a full path under the given storage root.
    /// Returns <c>null</c> when the URL is not a well-formed document URL or tries to
    /// escape the storage root. Kept internal so callers cannot enumerate arbitrary
    /// directories through the same access path.
    /// </summary>
    public static string? ResolveFullPath(string root, string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl) || !relativeUrl.StartsWith("/documents/", StringComparison.Ordinal))
        {
            return null;
        }

        var rootFull = Path.GetFullPath(root);
        var candidateFull = Path.GetFullPath(Path.Combine(rootFull, relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));

        if (!candidateFull.StartsWith(rootFull + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return candidateFull;
    }

    /// <summary>Returns the display file name (last segment) of a persisted document URL.</summary>
    public static string? FileNameFromUrl(string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl))
        {
            return null;
        }

        var name = relativeUrl.Split('/').LastOrDefault();
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }
}