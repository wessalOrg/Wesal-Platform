using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Single validation rule-set for hall photo bytes (Edit 24): accepted extensions/MIME
/// types (JPEG/PNG/WebP), the 5 MB cap and the magic-byte signature check. Shared by
/// hall creation and hall updates so both paths accept and reject exactly the same
/// files; the rules themselves are unchanged.
/// </summary>
public static class HallPhotoUploadValidator
{
    private static readonly string[] PermittedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    private static readonly string[] PermittedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

    public const long MaxFileSize = 5 * 1024 * 1024;

    public static void EnsureValidImage(HallPhotoUpload upload, string fieldName)
    {
        if (upload is null || upload.Content.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = ["Invalid photo."]
            });
        }

        if (upload.Content.Length > MaxFileSize)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = ["Photo size must not exceed 5MB."]
            });
        }

        var extension = Path.GetExtension(upload.FileName).ToLowerInvariant();
        if (!PermittedExtensions.Contains(extension))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = [$"Photo extension '{extension}' is not permitted."]
            });
        }

        var mimeType = upload.ContentType.ToLowerInvariant();
        if (!PermittedMimeTypes.Contains(mimeType))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = [$"Photo MIME type '{upload.ContentType}' is not permitted."]
            });
        }

        if (!ExtensionMatchesMimeType(extension, mimeType))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = ["Photo extension does not match its MIME type."]
            });
        }

        if (!SignatureMatches(upload.Content, mimeType))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = ["Invalid image file."]
            });
        }
    }

    private static bool ExtensionMatchesMimeType(string extension, string mimeType)
        => (extension, mimeType) switch
        {
            (".jpg" or ".jpeg", "image/jpeg") => true,
            (".png", "image/png") => true,
            (".webp", "image/webp") => true,
            _ => false
        };

    private static bool SignatureMatches(byte[] content, string mimeType)
    {
        switch (mimeType)
        {
            // JPEG: FF D8 FF
            case "image/jpeg":
                return content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF;
            // PNG: 89 50 4E 47 0D 0A 1A 0A
            case "image/png":
                return content.Length >= 8
                    && content[0] == 0x89 && content[1] == 0x50 && content[2] == 0x4E && content[3] == 0x47
                    && content[4] == 0x0D && content[5] == 0x0A && content[6] == 0x1A && content[7] == 0x0A;
            // WEBP: RIFF....WEBP
            case "image/webp":
                return content.Length >= 12
                    && content[0] == 0x52 && content[1] == 0x49 && content[2] == 0x46 && content[3] == 0x46
                    && content[8] == 0x57 && content[9] == 0x45 && content[10] == 0x42 && content[11] == 0x50;
            default:
                return false;
        }
    }
}
