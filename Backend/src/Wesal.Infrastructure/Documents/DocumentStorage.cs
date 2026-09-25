using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Resolves the writable root directory for protected documents (owner identity documents
/// and conversation message attachments). Keep in sync with the static-file mapping in
/// <c>Program.cs</c>: this root must never be served by <c>UseStaticFiles</c>.
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

    public string ConversationAttachmentsDirectory(Guid conversationId)
        => Path.Combine(_root, "documents", "conversations", conversationId.ToString(), "attachments");
}