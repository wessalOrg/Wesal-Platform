using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Halls;

namespace Wesal.API.Infrastructure;

/// <summary>
/// Request-level upload limits derived from the real product contract (not invented):
/// at most 1 cover + 10 gallery photos (see CreateHallRequestValidator) at 5 MB each,
/// while identity documents and message attachments are single 5 MB files.
/// </summary>
public static class UploadLimits
{
    /// <summary>Per-file cap shared by every image/document upload (5 MB business rule).</summary>
    public const long MaxFileBytes = 5L * 1024 * 1024;

    /// <summary>
    /// Total multipart envelope for hall create/update: 1 cover + 10 gallery photos
    /// at 5 MB each (55 MB) plus multipart framing overhead.
    /// </summary>
    public const long HallFormRequestBytes = 60L * 1024 * 1024;

    /// <summary>Envelope for single-file forms (identity document, message attachment).</summary>
    public const long SingleFileRequestBytes = 6L * 1024 * 1024;
}

/// <summary>
/// Guards <see cref="IFormFile"/> uploads BEFORE their bytes are copied into memory:
/// the declared <see cref="IFormFile.Length"/> is known from the multipart framing,
/// so empty/oversized files are rejected with a clean 400 instead of being buffered
/// first and rejected later (or crashing on a missing part). Message wording mirrors
/// the service-level validators so clients see one contract.
/// </summary>
public static class UploadedFileGuard
{
    public static IFormFile EnsureGalleryPhoto(IFormFile? file)
        => EnsureUsable(file, "Photos", "Invalid photo.", "Photo size must not exceed 5MB.");

    /// <summary>
    /// Oversize-only check for optional uploads whose empty content must keep
    /// flowing downstream (e.g. an empty cover means "no cover", an empty gallery
    /// slot is rejected later as "Invalid photo."): only files over the cap fail here.
    /// </summary>
    public static void ThrowIfTooLarge(IFormFile file, string fieldName, string message)
    {
        if (file.Length > HallPhotoUploadValidator.MaxFileSize)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = [message]
            });
        }
    }

    public static IFormFile EnsureIdentityDocument(IFormFile? file)
    {
        if (file is null || file.Length == 0)
            throw new ValidationException("The uploaded document is empty.");
        if (file.Length > DocumentUploadValidator.MaxFileSize)
            throw new ValidationException("The uploaded document must not exceed 5MB.");
        return file;
    }

    public static IFormFile EnsureAttachmentImage(IFormFile? file)
    {
        if (file is null || file.Length == 0)
            throw new ValidationException("The attached image is empty.");
        if (file.Length > DocumentUploadValidator.MaxFileSize)
            throw new ValidationException("The attached image must not exceed 5MB.");
        return file;
    }

    private static IFormFile EnsureUsable(
        IFormFile? file,
        string fieldName,
        string missingMessage,
        string tooLargeMessage)
    {
        if (file is null || file.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = [missingMessage]
            });
        }

        if (file.Length > HallPhotoUploadValidator.MaxFileSize)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [fieldName] = [tooLargeMessage]
            });
        }

        return file;
    }
}
