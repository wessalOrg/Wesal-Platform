using Microsoft.AspNetCore.Http;
using Wesal.API.Infrastructure;
using Wesal.Domain.Exceptions;

namespace Wesal.Tests.Api;

/// <summary>
/// Request-level upload guard (production hardening, Phase 2): empty and oversized
/// files must fail with a clean 400 BEFORE their bytes are buffered, using the same
/// 5 MB business rule and wording as the service-level validators.
/// </summary>
public sealed class UploadedFileGuardShould
{
    private static IFormFile File(string name, string fileName, string contentType, long length)
    {
        var file = new FormFile(Stream.Null, 0, length, name, fileName);
        file.Headers = new HeaderDictionary { ["Content-Type"] = contentType };
        return file;
    }

    [Fact]
    public void GalleryPhoto_NullFile_ThrowsFieldError()
    {
        var ex = Assert.Throws<ValidationException>(() => UploadedFileGuard.EnsureGalleryPhoto(null));
        Assert.Contains("Photos", ex.Errors.Keys);
    }

    [Fact]
    public void GalleryPhoto_EmptyFile_ThrowsBeforeBuffering()
    {
        var ex = Assert.Throws<ValidationException>(() =>
            UploadedFileGuard.EnsureGalleryPhoto(File("photos", "a.jpg", "image/jpeg", 0)));
        Assert.Contains("Photos", ex.Errors.Keys);
    }

    [Fact]
    public void GalleryPhoto_OversizedFile_ThrowsSameRuleAsService()
    {
        var ex = Assert.Throws<ValidationException>(() =>
            UploadedFileGuard.EnsureGalleryPhoto(File("photos", "a.jpg", "image/jpeg", UploadLimits.MaxFileBytes + 1)));
        Assert.Equal("Photo size must not exceed 5MB.", Assert.Single(ex.Errors["Photos"]));
    }

    [Fact]
    public void GalleryPhoto_ExactlyAtLimit_Passes()
    {
        var file = File("photos", "a.jpg", "image/jpeg", UploadLimits.MaxFileBytes);
        Assert.Same(file, UploadedFileGuard.EnsureGalleryPhoto(file));
    }

    [Fact]
    public void IdentityDocument_MissingFile_ThrowsInsteadOfNullReference()
    {
        var ex = Assert.Throws<ValidationException>(() => UploadedFileGuard.EnsureIdentityDocument(null));
        Assert.Contains("empty", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void IdentityDocument_OversizedFile_Throws()
    {
        var ex = Assert.Throws<ValidationException>(() =>
            UploadedFileGuard.EnsureIdentityDocument(File("file", "id.pdf", "application/pdf", UploadLimits.MaxFileBytes + 1)));
        Assert.Contains("5MB", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AttachmentImage_OversizedFile_ThrowsBeforeBuffering()
    {
        var ex = Assert.Throws<ValidationException>(() =>
            UploadedFileGuard.EnsureAttachmentImage(File("file", "proof.png", "image/png", UploadLimits.MaxFileBytes + 1)));
        Assert.Contains("5MB", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void ThrowIfTooLarge_AtLimit_DoesNotThrow()
    {
        UploadedFileGuard.ThrowIfTooLarge(File("photos", "a.jpg", "image/jpeg", UploadLimits.MaxFileBytes), "Photos", "too big");
    }

    [Fact]
    public void UploadLimits_EnvelopeFitsRealContract()
    {
        // 1 cover + 10 gallery photos (CreateHallRequestValidator) at 5 MB each.
        Assert.True(UploadLimits.HallFormRequestBytes >= 11 * UploadLimits.MaxFileBytes);
        Assert.True(UploadLimits.SingleFileRequestBytes >= UploadLimits.MaxFileBytes);
    }
}
