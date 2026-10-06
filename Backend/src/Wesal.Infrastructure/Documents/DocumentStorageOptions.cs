namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Configuration for the protected document storage of owner documents (identity
/// documents and conversation message attachments). This root is intentionally
/// different from the hall media root and is NEVER mapped via the public static-file
/// provider: documents are only served through authenticated endpoints. Defaults to the
/// OS temp directory so deployment does not depend on a writable web root.
///
/// <see cref="Provider"/> selects where identity documents are stored: <c>Local</c>
/// (this root) or <c>Supabase</c> (a private Supabase Storage bucket, durable across
/// redeploys). Conversation attachments always stay on this local root.
/// </summary>
public sealed class DocumentStorageOptions
{
    public const string SectionName = "DocumentStorage";

    public string? Directory { get; set; }

    /// <summary><c>Local</c> or <c>Supabase</c>. Empty = auto-detect.</summary>
    public string? Provider { get; set; }
}