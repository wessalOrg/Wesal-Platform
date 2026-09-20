namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Configuration for the protected on-disk storage of owner documents (identity documents
/// and payment receipts). This root is intentionally different from the hall media root
/// and is NEVER mapped via the public static-file provider: documents are only served
/// through authenticated endpoints. Defaults to the OS temp directory so deployment does
/// not depend on a writable web root.
/// </summary>
public sealed class DocumentStorageOptions
{
    public const string SectionName = "DocumentStorage";

    public string? Directory { get; set; }
}