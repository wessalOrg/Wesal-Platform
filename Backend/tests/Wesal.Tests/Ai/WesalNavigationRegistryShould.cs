using System.Text.RegularExpressions;
using Wesal.Application.Ai.Navigation;

namespace Wesal.Tests.Ai;

public class WesalNavigationRegistryShould
{
    private static IEnumerable<string> FrontendRoutes()
    {
        var app = Path.Combine(RepoPaths.Root(), "Frontend", "src", "app");
        foreach (var file in Directory.EnumerateFiles(app, "page.tsx", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(app, Path.GetDirectoryName(file)!).Replace('\\', '/');
            var route = relative == "." ? "/" : "/" + relative;
            yield return Regex.Replace(route, @"\[[^\]]+\]", "{id}");
        }
    }

    [Fact]
    public void EveryRegistryPage_IsARealFrontendRoute()
    {
        var real = FrontendRoutes().ToHashSet(StringComparer.Ordinal);
        Assert.NotEmpty(real);

        foreach (var page in WesalNavigationRegistry.Pages)
        {
            Assert.True(real.Contains(page.Path), $"Registry page '{page.Key}' ({page.Path}) has no Frontend/src/app page.tsx");
        }
    }

    [Fact]
    public void RegistryKeysAndPaths_AreUnique()
    {
        Assert.Equal(WesalNavigationRegistry.Pages.Count, WesalNavigationRegistry.Pages.Select(p => p.Key).Distinct().Count());
        Assert.Equal(WesalNavigationRegistry.Pages.Count, WesalNavigationRegistry.Pages.Select(p => p.Path).Distinct().Count());
    }

    [Fact]
    public void PhotographyPage_IsNeverAssistantNavigable()
    {
        // A /photographers route exists as a coming-soon placeholder (added for
        // the landing category cards), so "no such route exists" is no longer
        // true. The security property that matters is navigability: the
        // assistant must never offer or resolve navigation to any
        // photography/media URL. Registry entries for such pages, if any, must
        // stay page-context only (AssistantNavigable = false), mirroring how
        // admin/owner-manage pages are recognised without being offered.
        static bool IsPhotoPage(WesalPage p) =>
            p.Key.Contains("photo", StringComparison.OrdinalIgnoreCase)
            || p.Path.Contains("photo", StringComparison.OrdinalIgnoreCase)
            || p.Path.Contains("media", StringComparison.OrdinalIgnoreCase);

        Assert.DoesNotContain(WesalNavigationRegistry.NavigablePages, (WesalPage p) => IsPhotoPage(p));
        foreach (var page in WesalNavigationRegistry.Pages.Where(IsPhotoPage))
        {
            Assert.False(page.AssistantNavigable,
                $"Registry page '{page.Key}' ({page.Path}) must stay context-only; the assistant must never navigate to photography pages.");
        }

        foreach (var route in FrontendRoutes().Where(r => r.Contains("photo", StringComparison.OrdinalIgnoreCase)))
        {
            var registered = WesalNavigationRegistry.Pages.FirstOrDefault(p =>
                string.Equals(p.Path, route, StringComparison.Ordinal));
            Assert.True(registered is null || !registered.AssistantNavigable,
                $"Frontend route '{route}' must never be assistant-navigable.");
        }

        Assert.Null(WesalNavigationRegistry.ResolveHref("photography"));
    }

    [Theory]
    [InlineData("halls", "/halls")]
    [InlineData("faq", "/faq")]
    [InlineData("help", "/help")]
    [InlineData("login", "/login")]
    [InlineData("register", "/register")]
    [InlineData("home", "/")]
    [InlineData("bookings", "/profile/bookings")]
    public void ResolveHref_ReturnsTheTrustedPath(string key, string expected)
        => Assert.Equal(expected, WesalNavigationRegistry.ResolveHref(key));

    [Theory]
    [InlineData("admin")]
    [InlineData("admin_hall_review")]
    [InlineData("owner_hall_manage")]
    [InlineData("reset_password")]
    [InlineData("https://evil.example")]
    [InlineData("//evil.example")]
    [InlineData("javascript:alert(1)")]
    [InlineData("")]
    [InlineData(null)]
    public void ResolveHref_RefusesNonNavigableOrInventedKeys(string? key)
        => Assert.Null(WesalNavigationRegistry.ResolveHref(key));

    [Fact]
    public void ResolveHref_DynamicHallPage_RequiresAValidId()
    {
        var id = Guid.NewGuid();
        Assert.Equal($"/halls/{id:D}", WesalNavigationRegistry.ResolveHref("hall_details", id));
        Assert.Null(WesalNavigationRegistry.ResolveHref("hall_details"));
        Assert.Null(WesalNavigationRegistry.ResolveHref("hall_details", Guid.Empty));
    }

    [Fact]
    public void TryMatchPath_ExtractsHallIdFromTheHallDetailsRoute()
    {
        var id = Guid.NewGuid();
        Assert.True(WesalNavigationRegistry.TryMatchPath($"/halls/{id}", out var page, out var entity));
        Assert.Equal("hall_details", page!.Key);
        Assert.Equal(id, entity);
        Assert.True(WesalNavigationRegistry.TryMatchPath($"/halls/{id}/?x=1#frag", out var page2, out var entity2));
        Assert.Equal("hall_details", page2!.Key);
        Assert.Equal(id, entity2);
    }

    [Fact]
    public void TryMatchPath_DoesNotSurfaceNonHallIds()
    {
        Assert.True(WesalNavigationRegistry.TryMatchPath("/owner/halls/not-a-guid", out var page, out var entity));
        Assert.Equal("owner_hall_manage", page!.Key);
        Assert.Null(entity);
        Assert.True(WesalNavigationRegistry.TryMatchPath("/halls/not-a-guid", out var hall, out var hallEntity));
        Assert.Equal("hall_details", hall!.Key);
        Assert.Null(hallEntity);
    }

    [Theory]
    [InlineData("//evil.example/halls")]
    [InlineData("https://evil.example/halls")]
    [InlineData("javascript:alert(1)")]
    [InlineData("/halls/../admin")]
    [InlineData("\\\\evil\\share")]
    [InlineData("/photography")]
    [InlineData("/halls/abc/def/ghi")]
    [InlineData("halls")]
    [InlineData("")]
    [InlineData(null)]
    public void TryMatchPath_RejectsSpoofedOrUnknownPaths(string? path)
        => Assert.False(WesalNavigationRegistry.TryMatchPath(path, out _, out _));

    [Fact]
    public void TryMatchPath_RejectsOverlongPaths()
        => Assert.False(WesalNavigationRegistry.TryMatchPath("/" + new string('a', 500), out _, out _));
}
