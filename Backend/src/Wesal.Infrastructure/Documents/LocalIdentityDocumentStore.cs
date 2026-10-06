using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Filesystem-backed identity-document store (Development and tests). Mirrors the
/// durable store's contract: a write that fails throws, a read of a vanished file
/// returns null instead of surfacing an unrelated storage exception, and the path is
/// always resolved from the persisted URL — never from caller input.
/// </summary>
public sealed class LocalIdentityDocumentStore : IIdentityDocumentStore
{
    private readonly IDocumentStorage _storage;

    public LocalIdentityDocumentStore(IDocumentStorage storage)
    {
        _storage = storage;
    }

    public async Task SaveAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
    {
        var fullPath = DocumentPath.ResolveFullPath(_storage.Root, relativeUrl)
            ?? throw new ValidationException("The identity document path is not valid.");

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllBytesAsync(fullPath, content, cancellationToken);
    }

    public async Task<StoredDocumentContent?> ReadAsync(string relativeUrl, CancellationToken cancellationToken = default)
    {
        var fullPath = DocumentPath.ResolveFullPath(_storage.Root, relativeUrl);
        if (fullPath is null || !File.Exists(fullPath))
        {
            return null;
        }

        try
        {
            return new StoredDocumentContent
            {
                Bytes = await File.ReadAllBytesAsync(fullPath, cancellationToken),
                LocalPath = fullPath
            };
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            // Deleted between the existence check and the read: same as never written.
            return null;
        }
    }

    public Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default)
    {
        var fullPath = DocumentPath.ResolveFullPath(_storage.Root, relativeUrl);
        if (fullPath is not null && File.Exists(fullPath))
        {
            try
            {
                File.Delete(fullPath);
            }
            catch
            {
                // Best-effort cleanup; an orphaned file is harmless (never served publicly).
            }
        }

        return Task.CompletedTask;
    }
}
