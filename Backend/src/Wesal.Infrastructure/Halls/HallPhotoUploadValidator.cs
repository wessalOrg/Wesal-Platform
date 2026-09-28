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

        if (!SignatureMatches(upload.Content, mimeType))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = ["Invalid image file."]
            });
        }
    }

    private static bool SignatureMatches(byte[] content, string mimeType)
    {
        if (content.Length < 4) return false;
        // JPEG: FF D8 FF
        if (mimeType == "image/jpeg" && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF) return true;
        // PNG: 89 50 4E 47
        if (mimeType == "image/png" && content[0] == 0x89 && content[1] == 0x50 && content[2] == 0x4E && content[3] == 0x47) return true;
        // WEBP: RIFF....WEBP
        if (mimeType == "image/webp" && content.Length >= 12 && content[0] == 0x52 && content[1] == 0x49 && content[2] == 0x46 && content[3] == 0x46 && content[8] == 0x57 && content[9] == 0x45 && content[10] == 0x42 && content[11] == 0x50) return true;
        // Allow jpg with jpeg mime
        if (mimeType == "image/jpeg" || mimeType == "image/jpg") return true;
        return false;
    }
}
