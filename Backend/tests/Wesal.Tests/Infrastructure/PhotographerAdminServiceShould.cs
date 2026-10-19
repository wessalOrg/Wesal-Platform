using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Photographers;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Administrator-only reads of a photographer's personal ID document: the bytes flow
/// through the authorization-protected service path (never a public URL), a user
/// without a submission returns 404 so the endpoint cannot probe arbitrary accounts,
/// and a missing document is 404 rather than an empty success.
/// </summary>
public class PhotographerAdminServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly FakeStore _store = new();

    public PhotographerAdminServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentityCore<ApplicationUser>().AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private PhotographerAdminService CreateService() => new(
        _userManager,
        new PhotographerRepository(_context),
        _store);

    private async Task<ApplicationUser> CreatePhotographerWithProfileAsync(
        string email,
        string? identityDocumentUrl = "documents/photographers/{0}/id.pdf")
    {
        var user = new ApplicationUser { FullName = "Photographer", Email = email, UserName = email };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(string.Join(",", result.Errors.Select(e => e.Description)));
        }

        var url = identityDocumentUrl is null ? string.Empty : string.Format(identityDocumentUrl, user.Id);
        _context.PhotographerProfiles.Add(new PhotographerProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            HasStudio = true,
            StudioName = "Noor Studio",
            StudioLocation = "Ramallah",
            DetailedStudioLocation = "Al-Irsal Street",
            FullName = null,
            PhoneNumber = "+970599111111",
            IdentityDocumentUrl = url,
            SubmittedAt = DateTimeOffset.UtcNow
        });
        await _context.SaveChangesAsync();

        if (!string.IsNullOrEmpty(url))
        {
            _store.Documents[url] = [(byte)'%', (byte)'P', (byte)'D', (byte)'F', (byte)'-', 0x31];
        }

        return user;
    }

    [Fact]
    public async Task ReturnsTheStoredBytes_WithContentTypeAndFileName()
    {
        var user = await CreatePhotographerWithProfileAsync("adminread@example.com");
        var service = CreateService();

        var document = await service.GetPhotographerIdentityDocumentAsync(user.Id);

        Assert.NotNull(document.Content);
        Assert.Equal((byte)'%', document.Content![0]);
        Assert.Equal("application/pdf", document.ContentType);
        Assert.Equal("id.pdf", document.FileName);
        Assert.StartsWith($"documents/photographers/{user.Id}/", document.RelativeUrl);
    }

    [Fact]
    public async Task UserWithoutPhotographerProfile_ReturnsNotFound()
    {
        var user = new ApplicationUser { FullName = "Plain", Email = "plain@example.com", UserName = "plain@example.com" };
        await _userManager.CreateAsync(user, "Password123!");
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetPhotographerIdentityDocumentAsync(user.Id));
    }

    [Fact]
    public async Task UnknownUserId_ReturnsNotFound()
    {
        var service = CreateService();
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetPhotographerIdentityDocumentAsync(Guid.NewGuid().ToString()));
    }

    [Fact]
    public async Task ProfileWithEmptyDocumentUrl_ReturnsNotFound()
    {
        var user = await CreatePhotographerWithProfileAsync("empty@example.com", identityDocumentUrl: null);
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetPhotographerIdentityDocumentAsync(user.Id));
    }

    [Fact]
    public async Task DocumentMissingFromStore_ReturnsNotFound()
    {
        var user = await CreatePhotographerWithProfileAsync("missing@example.com");
        _store.Documents.Clear();
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetPhotographerIdentityDocumentAsync(user.Id));
    }

    [Fact]
    public async Task DeletedUser_WithProfile_ReturnsNotFound()
    {
        var user = await CreatePhotographerWithProfileAsync("deleted@example.com");
        await _userManager.DeleteAsync(user);
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetPhotographerIdentityDocumentAsync(user.Id));
    }

    [Fact]
    public async Task Result_NeverCarriesAPublicUrl()
    {
        var user = await CreatePhotographerWithProfileAsync("nourl@example.com");
        var service = CreateService();

        var document = await service.GetPhotographerIdentityDocumentAsync(user.Id);

        Assert.DoesNotContain("http", document.RelativeUrl, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("supabase", document.RelativeUrl, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("http", document.FullPath, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Result_NeverExposesTheAdminOnlyFullName()
    {
        // The stored FullName must never travel with the document response; only the
        // document bytes and their metadata are returned.
        var user = await CreatePhotographerWithProfileAsync("fullname@example.com");
        var profile = await _context.PhotographerProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        profile.FullName = "Ahmad Khalil";
        await _context.SaveChangesAsync();

        var service = CreateService();
        var document = await service.GetPhotographerIdentityDocumentAsync(user.Id);

        var json = System.Text.Json.JsonSerializer.Serialize(document);
        Assert.DoesNotContain("Ahmad Khalil", json);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class FakeStore : IIdentityDocumentStore
    {
        public Dictionary<string, byte[]> Documents { get; } = new(StringComparer.Ordinal);

        public Task SaveAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
        {
            Documents[relativeUrl] = content;
            return Task.CompletedTask;
        }

        public Task<StoredDocumentContent?> ReadAsync(string relativeUrl, CancellationToken cancellationToken = default)
            => Task.FromResult(Documents.TryGetValue(relativeUrl, out var bytes)
                ? new StoredDocumentContent { Bytes = bytes }
                : null);

        public Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default)
        {
            Documents.Remove(relativeUrl);
            return Task.CompletedTask;
        }
    }
}
