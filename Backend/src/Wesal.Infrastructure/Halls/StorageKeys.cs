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
}
