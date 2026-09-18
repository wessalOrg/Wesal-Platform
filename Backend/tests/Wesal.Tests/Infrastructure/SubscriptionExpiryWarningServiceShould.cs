using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Warnings;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class SubscriptionExpiryWarningServiceShould : IDisposable
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(FixedNow.UtcDateTime);

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly FakeEmailService _emailService;

    public SubscriptionExpiryWarningServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddIdentityCore<ApplicationUser>(o =>
        {
            o.Password.RequireDigit = true;
            o.Password.RequireLowercase = true;
            o.Password.RequireUppercase = true;
            o.Password.RequireNonAlphanumeric = true;
            o.Password.RequiredLength = 8;
            o.User.RequireUniqueEmail = true;
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.Admin)).GetAwaiter().GetResult();
        _emailService = new FakeEmailService();
    }

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone)
    {
        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = phone };
        await userManager.CreateAsync(user, "Password123!");
        await userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private Hall AddPaidHall(string ownerId, string name, DateOnly cycleEnd, DateOnly? warnedFor = null, int attempts = 0)
    {
        var hall = new Hall
        {
            Name = name,
            Address = "Gaza",
            Region = HallRegion.Gaza,
            Capacity = 100,
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            SubscriptionCycleStart = cycleEnd.AddDays(-30),
            SubscriptionCycleEnd = cycleEnd,
            WarningSentForCycleEnd = warnedFor,
            WarningSentAttempts = attempts
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private SubscriptionExpiryWarningService CreateService()
        => new(
            new AdminDashboardRepository(_context),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            _emailService,
            Options.Create(new SubscriptionExpiryWarningOptions { IntervalMinutes = 1440, EscalationThreshold = 3 }),
            new UnitOfWork(_context),
            new FakeDateTime(),
            NullLogger<SubscriptionExpiryWarningService>.Instance);

    private async Task<List<Message>> MessagesForAsync(Guid hallId)
    {
        return await _context.Messages
            .Join(_context.Conversations, m => m.ConversationId, c => c.Id, (m, c) => new { m, c })
            .Where(x => x.c.HallId == hallId)
            .Select(x => x.m)
            .ToListAsync();
    }

    [Fact]
    public async Task WarnsCycleEndingInExactlyThreeDays()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddPaidHall(owner.Id, "Grand Hall", Today.AddDays(3));

        var delivered = await CreateService().WarnCyclesEndingSoonAsync();

        Assert.Equal(1, delivered);
        Assert.Single(await MessagesForAsync(hall.Id));
        Assert.Single(_emailService.SentTo);
        Assert.Equal(owner.Email, _emailService.SentTo.Single());

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(Today.AddDays(3), reloaded!.WarningSentForCycleEnd);
        Assert.Equal(0, reloaded.WarningSentAttempts);
    }

    [Fact]
    public async Task DoesNotWarnOtherCycles()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddPaidHall(owner.Id, "Grand Hall", Today.AddDays(3));
        AddPaidHall(owner.Id, "Not Due Yet", Today.AddDays(10));
        AddPaidHall(owner.Id, "Overdue", Today.AddDays(-2));

        var delivered = await CreateService().WarnCyclesEndingSoonAsync();

        Assert.Equal(1, delivered);
        Assert.Single(await MessagesForAsync(hall.Id));
        Assert.Single(_emailService.SentTo);
    }

    [Fact]
    public async Task RepeatedRunsOnSameDay_DoNotReWarnSameCycle()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddPaidHall(owner.Id, "Grand Hall", Today.AddDays(3));

        var service = CreateService();
        var first = await service.WarnCyclesEndingSoonAsync();
        var second = await service.WarnCyclesEndingSoonAsync();

        Assert.Equal(1, first);
        Assert.Equal(0, second);
        Assert.Single(await MessagesForAsync(hall.Id));
        Assert.Single(_emailService.SentTo);
    }

    [Fact]
    public async Task FailedEmail_IsRetried_AndEscalatesAfterThreshold()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddPaidHall(owner.Id, "Grand Hall", Today.AddDays(3));

        var service = CreateService();

        _emailService.Result = false;
        var first = await service.WarnCyclesEndingSoonAsync();
        Assert.Equal(0, first);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(1, reloaded!.WarningSentAttempts);
        Assert.Equal(Today.AddDays(3), reloaded.WarningSentForCycleEnd);
        Assert.Single(await MessagesForAsync(hall.Id));

        // A later run (cycle still in the future, attempts > 0) retries only the e-mail,
        // without duplicating the in-app warning.
        _emailService.Result = false;
        var second = await service.WarnCyclesEndingSoonAsync();
        Assert.Equal(0, second);
        reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(2, reloaded!.WarningSentAttempts);
        Assert.Single(await MessagesForAsync(hall.Id));

        // Third failure crosses the threshold and never silently drops the warning.
        _emailService.Result = true;
        var third = await service.WarnCyclesEndingSoonAsync();
        Assert.Equal(1, third);
        reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(0, reloaded!.WarningSentAttempts);

        var messages = await MessagesForAsync(hall.Id);
        Assert.Single(messages);
        Assert.Contains("ends on", messages[0].Content, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(hall.Name, messages[0].Content);
    }

    [Fact]
    public async Task WarningContent_IncludesHallAndExactExpiry()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddPaidHall(owner.Id, "Grand Hall", Today.AddDays(3));

        await CreateService().WarnCyclesEndingSoonAsync();

        var message = (await MessagesForAsync(hall.Id)).Single();
        Assert.Contains(hall.Name, message.Content);
        Assert.Contains(Today.AddDays(3).ToString("yyyy-MM-dd"), message.Content);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class FakeEmailService : IEmailService
    {
        public bool Result { get; set; } = true;
        public List<string> SentTo { get; } = [];

        public Task<bool> TrySendAsync(
            string to,
            string subject,
            string body,
            CancellationToken cancellationToken = default)
        {
            if (Result)
            {
                SentTo.Add(to);
            }

            return Task.FromResult(Result);
        }
    }

    private sealed class FakeDateTime : IDateTime
    {
        public DateTimeOffset Now => FixedNow;
    }
}