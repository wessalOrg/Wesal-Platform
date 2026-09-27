using Microsoft.AspNetCore.Mvc;
using Wesal.Domain.Exceptions;

namespace Wesal.API.Infrastructure;

/// <summary>
/// Serves protected stored documents (owner identity documents) as HTTP responses
/// (Edit 28). The bytes are read inside the request so a file deleted between the
/// service check and the response surfaces as a proper 404 instead of the unrelated
/// 500 that <see cref="ControllerBase.PhysicalFile(string, string)"/> produces when
/// the file vanishes before the result executes. Documents are small (uploads are
/// capped at 5 MB), so buffering them is safe.
/// </summary>
public static class StoredDocumentResult
{
    public static async Task<IActionResult> ServeAsync(
        string fullPath,
        string contentType,
        CancellationToken cancellationToken)
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

        return new FileContentResult(content, contentType);
    }
}
