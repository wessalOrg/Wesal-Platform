namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Resolves the storage root used for protected documents (owner identity documents and
/// payment receipts). Unlike hall media, this root is NEVER mapped into the public
/// static-file area: documents are only served through authenticated endpoints whose
/// paths are resolved from persisted URLs.
/// </summary>
public interface IDocumentStorage
{
    string Root { get; }

    string OwnerDocumentsDirectory(string ownerId);

    string HallReceiptsDirectory(Guid hallId);
}