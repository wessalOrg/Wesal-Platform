namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Immutable storage-key rules shared by every hall-media provider.
/// Keys are always <c>halls/{hallId}/{guid}.{extension}</c>: never the
/// owner-supplied filename, never spaces, never user-controlled directories.
/// The validated extension is preserved; validation itself stays in
/// <see cref="HallPhotoUploadValidator"/>.
/// </summary>
public static class StorageKeys
{
    public static string ForHallPhoto(Guid hallId, string fileName)
        => $"halls/{hallId:D}/{fileName}";

    public static string NewFileName(string extension)
        => $"{Guid.NewGuid():N}{extension}";

    /// <summary>
    /// True when <paramref name="key"/> is exactly a hall media object key
    /// (<c>halls/{hallId}/{fileName}</c>, never a container root, never an upward
    /// traversal, never a file with folder separators). Used before compensating a
    /// delete so a malformed handle can never address a different object.
    /// </summary>
    public static bool IsValidHallPhotoKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return false;
        }

        var segments = key.Split('/');
        if (segments.Length != 3
            || !string.Equals(segments[0], "halls", StringComparison.Ordinal)
            || !Guid.TryParseExact(segments[1], "D", out _))
        {
            return false;
        }

        var fileName = segments[2];
        return !string.IsNullOrWhiteSpace(fileName)
            && fileName.IndexOf('\\') < 0
            && !fileName.Contains("..", StringComparison.Ordinal);
    }
}
