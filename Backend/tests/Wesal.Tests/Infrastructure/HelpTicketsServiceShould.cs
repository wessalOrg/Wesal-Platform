using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Help;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// The durable Help Center ("مركز المساعدة"). The contract is that the owner is resolved only
/// from the authenticated session, only the Admin can reply, a reply flips the ticket to
/// "replied" and raises the owner's unread flag, and a ticket never leaks to another user.
/// Exercised against the real repository on an in-memory database.
/// </summary>
public class HelpTicketsServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HelpTicketsServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddIdentityCore<ApplicationUser>(o =>
        {
            o.Password.RequireDigit = true;
            o.Password.RequireNonAlphanumeric = true;
            o.Password.RequiredLength = 8;
            o.User.RequireUniqueEmail = true;
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.Admin)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    [Fact]
    public async Task Create_Guest_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        var exception = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateAsync(new CreateHelpTicketRequestDto { Question = "How do I book?" }));

        Assert.Contains("logged in", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Create_EmptyQuestion_ThrowsValidation()
    {
        var user = await CreateUserAsync("empty@example.com", "+970599500001");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateAsync(new CreateHelpTicketRequestDto { Question = "   " }));
    }

    [Fact]
    public async Task Create_TooLongQuestion_ThrowsValidation()
    {
        var user = await CreateUserAsync("long@example.com", "+970599500002");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        var question = new string('a', HelpTicketsService.MaxQuestionLength + 1);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateAsync(new CreateHelpTicketRequestDto { Question = question }));
    }

    [Fact]
    public async Task Create_TrimsAndStoresAnOpenTicketForTheCaller()
    {
        var user = await CreateUserAsync("seeker@example.com", "+970599500003");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        var created = await service.CreateAsync(new CreateHelpTicketRequestDto
        {
            UserName = "  Seeker  ",
            Question = "  How do I cancel a booking?  "
        });

        Assert.Equal(user.Id, created.UserId);
        Assert.Equal("Seeker", created.UserName);
        Assert.Equal("How do I cancel a booking?", created.Question);
        Assert.Equal("open", created.Status);
        Assert.False(created.UserUnread);
        Assert.Null(created.Reply);

        var persisted = Assert.Single(_context.HelpTickets);
        Assert.Equal(user.Id, persisted.UserId);
        Assert.Equal(HelpTicketStatus.Open, persisted.Status);
    }

    [Fact]
    public async Task Create_BlankUserName_FallsBackToANeutralLabel()
    {
        var user = await CreateUserAsync("anon@example.com", "+970599500004");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        var created = await service.CreateAsync(new CreateHelpTicketRequestDto
        {
            UserName = "   ",
            Question = "Hello?"
        });

        Assert.False(string.IsNullOrWhiteSpace(created.UserName));
    }

    [Fact]
    public async Task ListMine_ReturnsOnlyTheCallersTicketsNewestFirst()
    {
        var me = await CreateUserAsync("me@example.com", "+970599500005");
        var other = await CreateUserAsync("other@example.com", "+970599500006");
        var mine = CreateService(new FakeCurrentUser(me.Id, true));
        var theirs = CreateService(new FakeCurrentUser(other.Id, true));

        var first = await mine.CreateAsync(new CreateHelpTicketRequestDto { Question = "First" });
        await theirs.CreateAsync(new CreateHelpTicketRequestDto { Question = "Not mine" });
        var second = await mine.CreateAsync(new CreateHelpTicketRequestDto { Question = "Second" });

        var list = await mine.ListMineAsync();

        Assert.Equal([second.Id, first.Id], list.Select(ticket => ticket.Id));
        Assert.DoesNotContain(list, ticket => ticket.Question == "Not mine");
    }

    [Fact]
    public async Task MarkRead_UnknownTicket_ThrowsNotFound()
    {
        var user = await CreateUserAsync("seeker@example.com", "+970599500007");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.MarkReadAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task MarkRead_AnotherUsersTicket_ThrowsNotFound()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599500008");
        var intruder = await CreateUserAsync("intruder@example.com", "+970599500009");
        var created = await CreateService(new FakeCurrentUser(owner.Id, true))
            .CreateAsync(new CreateHelpTicketRequestDto { Question = "Private" });

        var service = CreateService(new FakeCurrentUser(intruder.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.MarkReadAsync(created.Id));
    }

    [Fact]
    public async Task MarkRead_ClearsTheUnreadReplyFlag()
    {
        var user = await CreateUserAsync("seeker@example.com", "+970599500010");
        var admin = await CreateUserAsync("admin@example.com", "+970599500011", ApplicationRoles.Admin);
        var created = await CreateService(new FakeCurrentUser(user.Id, true))
            .CreateAsync(new CreateHelpTicketRequestDto { Question = "Need help" });
        await CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin))
            .ReplyAsync(created.Id, new ReplyHelpTicketRequestDto { Reply = "Here you go" });

        var service = CreateService(new FakeCurrentUser(user.Id, true));
        await service.MarkReadAsync(created.Id);

        var list = await service.ListMineAsync();
        Assert.False(Assert.Single(list).UserUnread);
    }

    [Fact]
    public async Task Reply_SetsReplyStatusAndRaisesTheOwnerUnreadFlag()
    {
        var user = await CreateUserAsync("seeker@example.com", "+970599500012");
        var admin = await CreateUserAsync("admin@example.com", "+970599500013", ApplicationRoles.Admin);
        var created = await CreateService(new FakeCurrentUser(user.Id, true))
            .CreateAsync(new CreateHelpTicketRequestDto { Question = "Need help" });

        var replied = await CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin))
            .ReplyAsync(created.Id, new ReplyHelpTicketRequestDto { Reply = "  Here you go  " });

        Assert.Equal(created.Id, replied.Id);
        Assert.Equal("replied", replied.Status);
        Assert.Equal("Here you go", replied.Reply);
        Assert.True(replied.UserUnread);
        Assert.NotNull(replied.RepliedAt);

        var persisted = _context.HelpTickets.Single(ticket => ticket.Id == created.Id);
        Assert.Equal(HelpTicketStatus.Replied, persisted.Status);
        Assert.Equal(admin.Id, persisted.RepliedByUserId);
    }

    [Fact]
    public async Task Reply_Empty_ThrowsValidation()
    {
        var user = await CreateUserAsync("seeker@example.com", "+970599500014");
        var admin = await CreateUserAsync("admin@example.com", "+970599500015", ApplicationRoles.Admin);
        var created = await CreateService(new FakeCurrentUser(user.Id, true))
            .CreateAsync(new CreateHelpTicketRequestDto { Question = "Need help" });

        await Assert.ThrowsAsync<ValidationException>(() =>
            CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin))
                .ReplyAsync(created.Id, new ReplyHelpTicketRequestDto { Reply = "   " }));
    }

    [Fact]
    public async Task Reply_UnknownTicket_ThrowsNotFound()
    {
        var admin = await CreateUserAsync("admin@example.com", "+970599500016", ApplicationRoles.Admin);
        var service = CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin));

        await Assert.ThrowsAsync<NotFoundException>(() => service.ReplyAsync(
            Guid.NewGuid(),
            new ReplyHelpTicketRequestDto { Reply = "Hello" }));
    }

    [Fact]
    public async Task ListAll_ReturnsEveryTicketPagedNewestFirst()
    {
        var user = await CreateUserAsync("seeker@example.com", "+970599500017");
        var other = await CreateUserAsync("other@example.com", "+970599500018");
        var mine = CreateService(new FakeCurrentUser(user.Id, true));
        var theirs = CreateService(new FakeCurrentUser(other.Id, true));

        var first = await mine.CreateAsync(new CreateHelpTicketRequestDto { Question = "First" });
        var second = await mine.CreateAsync(new CreateHelpTicketRequestDto { Question = "Second" });
        var third = await theirs.CreateAsync(new CreateHelpTicketRequestDto { Question = "Third" });

        var admin = await CreateUserAsync("admin@example.com", "+970599500019", ApplicationRoles.Admin);
        var page = await CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin))
            .ListAllAsync(page: 1, pageSize: 2);

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(2, page.Items.Count);
        Assert.Equal([third.Id, second.Id], page.Items.Select(ticket => ticket.Id));
        Assert.DoesNotContain(page.Items, ticket => ticket.Id == first.Id);
    }

    [Fact]
    public void CreateRequest_DoesNotAcceptAnOwnerId()
    {
        // The owner must come from the session, so a client cannot file a ticket as another
        // user (or read somebody else's).
        var properties = typeof(CreateHelpTicketRequestDto).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.DoesNotContain("UserId", properties);
        Assert.DoesNotContain("OwnerId", properties);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private HelpTicketsService CreateService(FakeCurrentUser currentUser)
        => new(new HelpTicketRepository(_context), currentUser, TimeProvider.System);

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        string phone,
        string role = ApplicationRoles.RegisteredUser)
    {
        var user = new ApplicationUser { FullName = "Regular User", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool auth, string role = ApplicationRoles.RegisteredUser)
        {
            UserId = userId;
            IsAuthenticated = auth;
            Roles = userId is null ? [] : [role];
        }

        public string? UserId { get; }

        public string? UserName => "test";

        public string? Email => "test@example.com";

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; }
    }
}
