using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Validates an owner document upload: accepted extensions/MIME types are images
/// (JPEG/PNG/WebP) and PDF; the size limit is 5 MB and the file signature must match the
/// declared MIME type. Prevents disguised executables and oversized payloads before
/// anything is written to disk.
///
/// WESAL-TASK-4 (Edit 4): identity documents use <see cref="EnsureValid"/>, while
/// conversation message attachments use the stricter image-only
/// <see cref="EnsureValidImage"/>.
/// </summary>
public static class DocumentUploadValidator
{
    private static readonly string[] PermittedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

    private static readonly string[] PermittedMimeTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf"
    ];

    public const long MaxFileSize = 5 * 1024 * 1024;

    private static readonly string[] PermittedImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    private static readonly string[] PermittedImageMimeTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    /// <summary>
    /// Validates a conversation message image attachment (WESAL-TASK-4, Edit 4). Stricter
    /// than <see cref="EnsureValid"/>: only raster images are accepted, never PDF, so an
    /// attachment rendered inline in the thread can never carry a non-image document.
    /// The 5 MB limit and the magic-byte signature check are identical.
    /// </summary>
    public static void EnsureValidImage(OwnerDocumentUpload upload)
    {
        if (upload is null || upload.Content.Length == 0)
        {
            throw new ValidationException("The attached image is empty.");
        }

        if (upload.Content.Length > MaxFileSize)
        {
            throw new ValidationException("The attached image must not exceed 5MB.");
        }

        var ext = Path.GetExtension(upload.FileName).ToLowerInvariant();
        if (!PermittedImageExtensions.Contains(ext))
        {
            throw new ValidationException($"The attachment extension '{ext}' is not permitted (allowed: jpg, jpeg, png, webp).");
        }

        var mime = upload.ContentType?.ToLowerInvariant() ?? string.Empty;
        if (!PermittedImageMimeTypes.Contains(mime))
        {
            throw new ValidationException($"The attachment MIME type '{upload.ContentType}' is not permitted (allowed: jpg, jpeg, png, webp).");
        }

        if (!SignatureMatches(upload.Content, mime))
        {
            throw new ValidationException("The attached file content does not match its declared image type.");
        }
    }

    public static void EnsureValid(OwnerDocumentUpload upload)
    {
        if (upload is null || upload.Content.Length == 0)
        {
            throw new ValidationException("The uploaded document is empty.");
        }

        if (upload.Content.Length > MaxFileSize)
        {
            throw new ValidationException("The uploaded document must not exceed 5MB.");
        }

        var ext = Path.GetExtension(upload.FileName).ToLowerInvariant();
        if (!PermittedExtensions.Contains(ext))
        {
            throw new ValidationException($"The document extension '{ext}' is not permitted (allowed: jpg, jpeg, png, webp, pdf).");
        }

        var mime = upload.ContentType?.ToLowerInvariant() ?? string.Empty;
        if (!PermittedMimeTypes.Contains(mime))
        {
            throw new ValidationException($"The document MIME type '{upload.ContentType}' is not permitted.");
        }

        if (!SignatureMatches(upload.Content, mime))
        {
            throw new ValidationException("The uploaded file content does not match its declared type.");
        }
    }

    private static bool SignatureMatches(byte[] content, string mimeType)
    {
        switch (mimeType)
        {
            case "image/jpeg":
                return content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF;
            case "image/png":
                return content.Length >= 8
                    && content[0] == 0x89 && content[1] == 0x50 && content[2] == 0x4E && content[3] == 0x47
                    && content[4] == 0x0D && content[5] == 0x0A && content[6] == 0x1A && content[7] == 0x0A;
            case "image/webp":
                return content.Length >= 12
                    && content[0] == 0x52 && content[1] == 0x49 && content[2] == 0x46 && content[3] == 0x46
                    && content[8] == 0x57 && content[9] == 0x45 && content[10] == 0x42 && content[11] == 0x50;
            case "application/pdf":
                return content.Length >= 5
                    && content[0] == 0x25 && content[1] == 0x50 && content[2] == 0x44 && content[3] == 0x46 && content[4] == 0x2D;
            default:
                return false;
        }
    }
}