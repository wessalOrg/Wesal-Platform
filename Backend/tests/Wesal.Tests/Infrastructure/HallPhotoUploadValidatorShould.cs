using System.Text;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Signature-validation guard for hall photo uploads (production hardening).
/// A disguised non-image payload declared as image/jpeg must never pass,
/// and the declared extension must agree with the declared MIME type.
/// </summary>
public sealed class HallPhotoUploadValidatorShould
{
    private static readonly byte[] ValidJpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46];
    private static readonly byte[] ValidPng = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];
    private static readonly byte[] ValidWebP =
        [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00];
    private static readonly byte[] NotAnImage = Encoding.ASCII.GetBytes("MZ: this is not an image at all....");

    private static HallPhotoUpload Upload(string fileName, string contentType, byte[] content)
        => new() { FileName = fileName, ContentType = contentType, Content = content };

    [Fact]
    public void FakeJpegBytes_AreRejected()
    {
        var ex = Assert.Throws<ValidationException>(() =>
            HallPhotoUploadValidator.EnsureValidImage(Upload("fake.jpg", "image/jpeg", NotAnImage), "Photos"));
        Assert.Contains("Photos", ex.Errors.Keys);
    }

    [Theory]
    [InlineData("photo.jpg", "image/jpeg")]
    [InlineData("photo.jpeg", "image/jpeg")]
    public void ValidJpeg_IsAccepted(string fileName, string contentType)
    {
        HallPhotoUploadValidator.EnsureValidImage(Upload(fileName, contentType, ValidJpeg), "Photos");
    }

    [Fact]
    public void ValidPng_IsAccepted()
    {
        HallPhotoUploadValidator.EnsureValidImage(Upload("photo.png", "image/png", ValidPng), "Photos");
    }

    [Fact]
    public void ValidWebP_IsAccepted()
    {
        HallPhotoUploadValidator.EnsureValidImage(Upload("photo.webp", "image/webp", ValidWebP), "Photos");
    }

    [Fact]
    public void TruncatedBytes_AreRejected()
    {
        Assert.Throws<ValidationException>(() =>
            HallPhotoUploadValidator.EnsureValidImage(Upload("tiny.jpg", "image/jpeg", [0xFF, 0xD8]), "Photos"));
    }

    [Fact]
    public void ExtensionMimeMismatch_IsRejected()
    {
        // Real JPEG bytes but a .png name claiming image/jpeg: extension and MIME disagree.
        Assert.Throws<ValidationException>(() =>
            HallPhotoUploadValidator.EnsureValidImage(Upload("photo.png", "image/jpeg", ValidJpeg), "Photos"));
    }

    [Fact]
    public void DisallowedExtension_IsRejected()
    {
        Assert.Throws<ValidationException>(() =>
            HallPhotoUploadValidator.EnsureValidImage(Upload("run.exe", "image/jpeg", ValidJpeg), "Photos"));
    }

    [Fact]
    public void OversizedPhoto_IsRejected()
    {
        var big = new byte[HallPhotoUploadValidator.MaxFileSize + 1];
        Array.Copy(ValidJpeg, big, ValidJpeg.Length);
        Assert.Throws<ValidationException>(() =>
            HallPhotoUploadValidator.EnsureValidImage(Upload("big.jpg", "image/jpeg", big), "Photos"));
    }
}
