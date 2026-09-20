using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Validates an owner document upload (identity document or payment receipt): accepted
/// extensions/MIME types are images (JPEG/PNG/WebP) and PDF; the size limit is 5 MB and
/// the file signature must match the declared MIME type. Prevents disguised executables
/// and oversized payloads before anything is written to disk.
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