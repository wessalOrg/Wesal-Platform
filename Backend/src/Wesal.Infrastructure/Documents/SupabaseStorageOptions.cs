namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Configuration for the Supabase Storage-backed private document store. The URL and
/// secret key are server-only (Render environment); nothing here is ever exposed to the
/// browser, and no public bucket is used for identity documents.
/// </summary>
public sealed class SupabaseStorageOptions
{
    public const string SectionName = "SupabaseStorage";

    /// <summary>Project URL, e.g. https://{ref}.supabase.co</summary>
    public string? Url { get; set; }

    /// <summary>Service/secret key. Stays on the server; grants full bucket access.</summary>
    public string? SecretKey { get; set; }

    /// <summary>
    /// Private bucket holding owner identity documents. Must be created with public
    /// access disabled — reads only ever happen server-side.
    /// </summary>
    public string IdentityDocumentsBucket { get; set; } = "identity-documents";

    /// <summary>
    /// Private bucket holding conversation message attachments. Same constraints as
    /// <see cref="IdentityDocumentsBucket"/>: private, never exposed through static
    /// files, reads only server-side after authorization.
    /// </summary>
    public string ConversationAttachmentsBucket { get; set; } = "conversation-attachments";

    /// <summary>
    /// PUBLIC bucket holding hall photos. Unlike the two private buckets above, hall
    /// images are served straight to browsers through the Supabase public object URL
    /// (<c>/storage/v1/object/public/{bucket}/...</c>), so this bucket must stay
    /// public-read enabled. Writes still require the server-side secret key and never
    /// carry credentials: the bucket flag only governs anonymous reads.
    /// </summary>
    public string HallImagesBucket { get; set; } = "hall-images";

    public int TimeoutSeconds { get; set; } = 30;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Url) && !string.IsNullOrWhiteSpace(SecretKey);
}
