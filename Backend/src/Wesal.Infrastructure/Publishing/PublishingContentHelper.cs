using System.Text.RegularExpressions;
using FluentValidation;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;
using ValidationException = Wesal.Domain.Exceptions.ValidationException;

namespace Wesal.Infrastructure.Publishing;

internal static partial class PublishingContentHelper
{
    public static readonly Regex Markup = new("<[^>]*>", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static string? SanitizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var plain = Markup.Replace(value, " ");
        var chars = plain.Select(ch => char.IsControl(ch) && ch is not '\r' and not '\n' and not '\t' ? ' ' : ch).ToArray();
        var cleaned = string.Join(' ', new string(chars).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return cleaned.Length == 0 ? null : cleaned;
    }

    public static (int Page, int Size, int Skip) PageWindow(int page, int pageSize)
    {
        var normalizedPage = page <= 0 ? 1 : page;
        var normalizedSize = pageSize <= 0 ? 10 : Math.Min(pageSize, 100);
        return (normalizedPage, normalizedSize, (normalizedPage - 1) * normalizedSize);
    }

    public static async Task ValidateAsync<T>(IValidator<T> validator, T value, CancellationToken cancellationToken)
    {
        var result = await validator.ValidateAsync(value, cancellationToken);
        if (!result.IsValid)
        {
            throw new ValidationException(result.Errors.GroupBy(error => error.PropertyName)
                .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage).ToArray()));
        }
    }

    public static void ValidateImages(IReadOnlyList<OwnerDocumentUpload> images)
    {
        if (images.Count > PublishingContentLimits.MaxImages)
            throw new ValidationException($"A post or offer may contain at most {PublishingContentLimits.MaxImages} images.");
        foreach (var image in images) DocumentUploadValidator.EnsureValidImage(image);
    }

    public static string PublicContentKey(string ownerId, OwnerDocumentUpload image)
    {
        DocumentUploadValidator.EnsureValidImage(image);
        var extension = image.ContentType.ToLowerInvariant() switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => throw new ValidationException("The image type is not supported.")
        };
        return DocumentPath.PublicContentRelativeUrl(ownerId, $"{Guid.NewGuid():N}{extension}");
    }

    public static async Task<IReadOnlyList<(string Key, string ContentType)>> SaveImagesAsync(
        string ownerId,
        IReadOnlyList<OwnerDocumentUpload> images,
        IIdentityDocumentStore store,
        CancellationToken cancellationToken)
    {
        ValidateImages(images);
        var saved = new List<(string Key, string ContentType)>();
        try
        {
            foreach (var image in images)
            {
                var key = PublicContentKey(ownerId, image);
                await store.SaveAsync(key, image.Content, cancellationToken);
                saved.Add((key, image.ContentType.ToLowerInvariant()));
            }
            return saved;
        }
        catch
        {
            await DeleteImagesAsync(saved.Select(image => image.Key), store);
            throw;
        }
    }

    public static async Task DeleteImagesAsync(IEnumerable<string> keys, IIdentityDocumentStore store)
    {
        foreach (var key in keys)
        {
            try { await store.DeleteAsync(key, CancellationToken.None); }
            catch { /* Files are private and unreferenced; a later cleanup can retry. */ }
        }
    }

    public static PublicProfileImageDto ToImage(Guid itemId, Guid imageId, int order, string route)
        => new() { Id = imageId, Order = order, Url = $"/api/v1/{route}/{itemId}/images/{imageId}" };
}
