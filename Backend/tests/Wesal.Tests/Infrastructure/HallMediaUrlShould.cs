using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Media URL contract for durable absolute URLs (Phase 20): genuine external
/// URLs (including R2 public URLs) round-trip untouched, legacy relative rows
/// keep working, and only absolute URLs pinned to a retired /uploads origin are
/// reduced back to relative paths.
/// </summary>
public sealed class HallMediaUrlShould
{
    private const string R2Cover = "https://media.example.com/halls/11111111-1111-1111-1111-111111111111/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg";
    private const string R2Gallery = "https://media.example.com/halls/11111111-1111-1111-1111-111111111111/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png";

    [Fact]
    public void NormalizePersistedUrl_R2AbsoluteUrl_PassesThrough()
    {
        Assert.Equal(R2Cover, HallMediaUrl.NormalizePersistedUrl(R2Cover));
    }

    [Fact]
    public void NormalizePersistedUrl_LegacyRelativeUrl_PassesThrough()
    {
        const string legacy = "/uploads/halls/11111111-1111-1111-1111-111111111111/cover.jpg";
        Assert.Equal(legacy, HallMediaUrl.NormalizePersistedUrl(legacy));
    }

    [Fact]
    public void NormalizePersistedUrl_RetiredAbsoluteUploadsUrl_ReducedToRelative()
    {
        const string retired = "https://old-deploy.example.com/uploads/halls/11111111-1111-1111-1111-111111111111/cover.jpg?x=1";
        Assert.Equal("/uploads/halls/11111111-1111-1111-1111-111111111111/cover.jpg?x=1", HallMediaUrl.NormalizePersistedUrl(retired));
    }

    [Fact]
    public void ResolveCoverUrl_PrefersStoredCoverOverGallery()
    {
        Assert.Equal(R2Cover, HallMediaUrl.ResolveCoverUrl(R2Cover, [R2Gallery]));
    }

    [Fact]
    public void ResolveCoverUrl_BlankCover_FallsBackToFirstGalleryUrl()
    {
        Assert.Equal(R2Gallery, HallMediaUrl.ResolveCoverUrl(null, [R2Gallery]));
        Assert.Equal(R2Gallery, HallMediaUrl.ResolveCoverUrl("  ", [R2Gallery]));
    }

    [Fact]
    public void ResolveCoverUrl_NoImages_ReturnsNull()
    {
        Assert.Null(HallMediaUrl.ResolveCoverUrl(null, null));
        Assert.Null(HallMediaUrl.ResolveCoverUrl(null, []));
    }
}
