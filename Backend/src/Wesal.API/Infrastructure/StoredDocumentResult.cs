using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.API.Infrastructure;

/// <summary>
/// Serves protected stored documents (owner identity documents, message attachments)
/// as HTTP responses (Edit 28, final audit). The bytes are read inside the request so
/// a file deleted between the service check and the response surfaces as a proper 404
/// instead of the unrelated 500 that
/// <see cref="ControllerBase.PhysicalFile(string, string, string)"/> produces when
/// the file vanishes before the result executes. Documents are small (uploads are
/// capped at 5 MB), so buffering them is safe.
/// </summary>
public static class StoredDocumentResult
{
    public static async Task<IActionResult> ServeAsync(
        string fullPath,
        string contentType,
        CancellationToken cancellationToken,
        string? fileDownloadName = null)
    {
        byte[] content;
        try
        {
            content = await File.ReadAllBytesAsync(fullPath, cancellationToken);
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            throw new NotFoundException("The requested document was not found.");
        }

        return new FileContentResult(content, contentType)
        {
            FileDownloadName = fileDownloadName
        };
    }

    /// <summary>
    /// Serves a document already read from its store. Object-store documents arrive as
    /// buffered bytes (there is no filesystem path), local ones keep their path; both
    /// produce the same inline response. Passing no download name keeps the response
    /// inline so the admin's preview renders instead of triggering a download.
    /// </summary>
    public static async Task<IActionResult> ServeAsync(
        StoredDocument document,
        CancellationToken cancellationToken,
        string? fileDownloadName = null)
    {
        if (document.Content is not null)
        {
            return new FileContentResult(document.Content, document.ContentType)
            {
                FileDownloadName = fileDownloadName
            };
        }

        if (string.IsNullOrEmpty(document.FullPath))
        {
            throw new NotFoundException("The requested document was not found.");
        }

        return await ServeAsync(document.FullPath, document.ContentType, cancellationToken, fileDownloadName);
    }
}
