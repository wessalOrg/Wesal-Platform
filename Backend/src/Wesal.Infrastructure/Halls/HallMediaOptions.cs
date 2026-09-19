namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Configuration for the local on-disk storage of hall media uploads.
/// The directory defaults to the OS temp directory so hall creation never
/// depends on the (typically read-only) web root of the deployed image.
/// </summary>
public sealed class HallMediaOptions
{
    public const string SectionName = "HallMedia";

    public string? Directory { get; set; }
}