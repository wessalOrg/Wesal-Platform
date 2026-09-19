using Microsoft.Extensions.Options;

namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Resolves the writable root directory for hall media uploads.
/// Defaults to <c>Path.GetTempPath()/wesal-media</c> so hall creation works on
/// hosts whose application content directory (web root) is read-only; the
/// directory can be overridden via the <c>HallMedia:Directory</c> config key.
/// </summary>
public sealed class HallMediaStorage : IHallMediaStorage
{
    private readonly string _root;

    public HallMediaStorage(IOptions<HallMediaOptions> options)
    {
        var configured = options.Value.Directory;
        _root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(Path.GetTempPath(), "wesal-media")
            : Path.GetFullPath(configured);
        Directory.CreateDirectory(_root);
    }

    public string Root => _root;

    public string HallsUploadDirectory(Guid hallId) => Path.Combine(_root, "halls", hallId.ToString());
}