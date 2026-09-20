using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Resolves the writable root directory for protected owner documents (identity documents
/// and payment receipts). Keep in sync with the static-file mapping in <c>Program.cs</c>:
/// this root must never be served by <c>UseStaticFiles</c>.
/// </summary>
public sealed class DocumentStorage : IDocumentStorage
{
    private readonly string _root;

    public DocumentStorage(IOptions<DocumentStorageOptions> options)
    {
        var configured = options.Value.Directory;
        _root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(Path.GetTempPath(), "wesal-documents")
            : Path.GetFullPath(configured);
        Directory.CreateDirectory(_root);
    }

    public string Root => _root;

    public string OwnerDocumentsDirectory(string ownerId)
        => Path.Combine(_root, "documents", "owners", ownerId);

    public string HallReceiptsDirectory(Guid hallId)
        => Path.Combine(_root, "documents", "halls", hallId.ToString(), "receipts");
}