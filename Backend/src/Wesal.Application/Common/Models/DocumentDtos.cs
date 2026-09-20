using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// A document uploaded through the owner document endpoints (identity card or payment
/// receipt). Content is validated for size, extension, MIME type and file signature
/// before it is persisted outside the public static-file area.
/// </summary>
public class OwnerDocumentUpload
{
    public string FileName { get; init; } = string.Empty;

    public string ContentType { get; init; } = string.Empty;

    public byte[] Content { get; init; } = [];

    public long Length => Content.Length;
}

/// <summary>
/// A document stored by the platform and addressable by its relative URL. The path is
/// resolved exclusively from the persisted URL (never from the request) so a caller can
/// never ask for an arbitrary file path.
/// </summary>
public class StoredDocument
{
    public string RelativeUrl { get; init; } = string.Empty;

    public string FullPath { get; init; } = string.Empty;

    public string ContentType { get; init; } = string.Empty;

    public string FileName { get; init; } = string.Empty;
}

/// <summary>Result of the Hall Owner's identity-document upload (US-OWNER-30).</summary>
public class IdentityDocumentUploadResult
{
    public DateTimeOffset? UploadedAt { get; init; }

    public bool HasDocument { get; init; }
}

/// <summary>
/// Result of the Hall Owner's payment-receipt upload (US-OWNER-31). The hall moves to
/// <see cref="HallPaymentStatus.ReceiptUploaded"/> and stays private until the Admin
/// confirms payment (US-ADMIN-10).
/// </summary>
public class PaymentReceiptUploadResult
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public HallPaymentStatus PaymentStatus { get; init; }

    public DateTimeOffset? UploadedAt { get; init; }

    public bool HasReceipt { get; init; }
}

/// <summary>
/// Grouped metadata used by the owner UI to drive the profile-completion banner near
/// the profile button (US-OWNER-30). No document content is exposed here.
/// </summary>
public class OwnerDocumentsStatusDto
{
    public bool HasIdentityDocument { get; init; }

    public DateTimeOffset? IdentityDocumentUploadedAt { get; init; }

    /// <summary>True when the owner has not yet uploaded the identity document required to add halls.</summary>
    public bool ProfileIncomplete => !HasIdentityDocument;
}