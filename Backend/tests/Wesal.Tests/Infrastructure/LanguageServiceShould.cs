using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Languages;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class LanguageServiceShould
{
    [Fact]
    public async Task GetLanguage_UserWithoutStoredPreference_ReturnsArabicDefault()
    {
        var (service, context) = CreateSut("user-1");
        context.Users.Add(CreateUser("user-1"));
        await context.SaveChangesAsync();

        var result = await service.GetLanguageAsync();

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task GetLanguage_UserWithEnglishPreference_ReturnsEnglish()
    {
        var (service, context) = CreateSut("user-1");
        context.Users.Add(CreateUser("user-1", Language.English));
        await context.SaveChangesAsync();

        var result = await service.GetLanguageAsync();

        Assert.Equal("en", result.Language);
    }

    [Fact]
    public async Task GetLanguage_Guest_ThrowsUnauthorized()
    {
        var (service, _) = CreateSut("user-1", authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetLanguageAsync());
    }

    [Fact]
    public async Task GetLanguage_UnknownAuthenticatedUser_ThrowsNotFound()
    {
        var (service, _) = CreateSut("ghost-user");

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetLanguageAsync());
    }

    [Fact]
    public async Task UpdateLanguage_Arabic_IsAcceptedAndPersisted()
    {
        var (service, context) = CreateSut("user-1");
        context.Users.Add(CreateUser("user-1", Language.English));
        await context.SaveChangesAsync();

        var result = await service.UpdateLanguageAsync(new UpdateLanguageRequest { Language = "ar" });

        Assert.Equal("ar", result.Language);

        var stored = await context.Users.SingleAsync(user => user.Id == "user-1");
        Assert.Equal(Language.Arabic, stored.PreferredLanguage);
    }

    [Fact]
    public async Task UpdateLanguage_English_IsAcceptedAndPersisted()
    {
        var (service, context) = CreateSut("user-1");
        context.Users.Add(CreateUser("user-1", Language.Arabic));
        await context.SaveChangesAsync();

        var result = await service.UpdateLanguageAsync(new UpdateLanguageRequest { Language = "en" });

        Assert.Equal("en", result.Language);

        var stored = await context.Users.SingleAsync(user => user.Id == "user-1");
        Assert.Equal(Language.English, stored.PreferredLanguage);
    }

    [Theory]
    [InlineData("fr")]
    [InlineData("de")]
    [InlineData("es")]
    [InlineData("Arabic")]
    [InlineData("English")]
    [InlineData("ARABIC")]
    [InlineData("unknown")]
    public async Task UpdateLanguage_UnsupportedCode_ThrowsValidation(string language)
    {
        var (service, context) = CreateSut("user-1");
        context.Users.Add(CreateUser("user-1"));
        await context.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateLanguageAsync(new UpdateLanguageRequest { Language = language }));
    }

    [Fact]
    public async Task UpdateLanguage_Guest_ThrowsUnauthorized()
    {
        var (service, _) = CreateSut("user-1", authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.UpdateLanguageAsync(new UpdateLanguageRequest { Language = "ar" }));
    }

    [Fact]
    public async Task UpdateLanguage_UnknownAuthenticatedUser_ThrowsNotFound()
    {
        var (service, _) = CreateSut("ghost-user");

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.UpdateLanguageAsync(new UpdateLanguageRequest { Language = "ar" }));
    }

    [Fact]
    public async Task UpdateLanguage_AffectsOnlyAuthenticatedUser()
    {
        var (service, context) = CreateSut("user-1");
        context.Users.AddRange(
            CreateUser("user-1", Language.Arabic),
            CreateUser("user-2", Language.English));
        await context.SaveChangesAsync();

        await service.UpdateLanguageAsync(new UpdateLanguageRequest { Language = "en" });

        var user1 = await context.Users.SingleAsync(user => user.Id == "user-1");
        var user2 = await context.Users.SingleAsync(user => user.Id == "user-2");
        Assert.Equal(Language.English, user1.PreferredLanguage);
        Assert.Equal(Language.English, user2.PreferredLanguage);
    }

    private static (ILanguageService Service, ApplicationDbContext DataContext) CreateSut(
        string userId,
        bool authenticated = true)
    {
        var services = new ServiceCollection();

        services.AddLogging();
        services.AddIdentityCore<ApplicationUser>()
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>();

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()));

        services.AddScoped<ICurrentUserService>(_ => new FakeCurrentUserService(userId, authenticated));
        services.AddScoped<ILanguageService, LanguageService>();

        var provider = services.BuildServiceProvider();

        var service = provider.GetRequiredService<ILanguageService>();
        var context = provider.GetRequiredService<ApplicationDbContext>();

        return (service, context);
    }

    private static ApplicationUser CreateUser(string id, Language language = Language.Arabic)
        => new()
        {
            Id = id,
            UserName = id,
            Email = $"{id}@example.com",
            PreferredLanguage = language
        };

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
        }

        public string? UserId { get; }

        public string? UserName => null;

        public string? Email => null;

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; } = [];
    }
}