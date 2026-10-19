using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Publishing;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public sealed class PublishingContentRulesShould
{
    private static readonly DateTimeOffset Now = new(2030, 1, 10, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void AcceptPostWithTextOnlyOrImagesWithoutCaption()
    {
        var validator = new CreatePostRequestValidator();
        Assert.True(validator.Validate(new CreatePostRequest { Content = "Text-only post" }).IsValid);
        Assert.True(validator.Validate(new CreatePostRequest { Images = [Image()] }).IsValid);
        Assert.True(validator.Validate(new CreatePostRequest { Content = "Caption", Images = [Image(), Image()] }).IsValid);
    }

    [Fact]
    public void RejectEmptyPostAndInvalidMoneyOrImageCount()
    {
        var validator = new CreatePostRequestValidator();
        Assert.False(validator.Validate(new CreatePostRequest()).IsValid);
        Assert.False(validator.Validate(new CreatePostRequest { Content = "x", Price = -1 }).IsValid);
        Assert.False(validator.Validate(new CreatePostRequest { Content = "x", Price = 1.234m }).IsValid);
        Assert.False(validator.Validate(new CreatePostRequest { Images = Enumerable.Repeat(Image(), 11).ToArray() }).IsValid);
    }

    [Fact]
    public void EnforceOfferPriceWindowAndTextOrImageRules()
    {
        var validator = new CreateProfessionalOfferRequestValidator(new FixedTimeProvider(Now));
        Assert.True(validator.Validate(Offer(content: "text only")).IsValid);
        Assert.True(validator.Validate(Offer(images: [Image()])).IsValid);
        Assert.False(validator.Validate(Offer()).IsValid);
        Assert.False(validator.Validate(Offer(oldPrice: 10, offerPrice: 10, content: "x")).IsValid);
        Assert.False(validator.Validate(Offer(oldPrice: 10, offerPrice: 11, content: "x")).IsValid);
        Assert.False(validator.Validate(Offer(endsAt: Now.AddMinutes(-1), content: "x")).IsValid);
        Assert.False(validator.Validate(Offer(startsAt: Now.AddHours(3), endsAt: Now.AddHours(2), content: "x")).IsValid);
        Assert.False(validator.Validate(Offer(oldPrice: 10.001m, offerPrice: 5, content: "x")).IsValid);
    }

    [Fact]
    public void KeepTheExactArabicOfferAndPostNotificationTemplatesAndTargets()
    {
        var photographerPublished = NotificationCatalog.Render(NotificationKind.ProfessionalOfferPublishedForPhotographer,
            Language.Arabic, targetId: "offer-id");
        Assert.Equal("تم نشر عرضك بنجاح", photographerPublished.Title);
        Assert.Equal("عرض تصوير المناسبات أصبح متاحًا للمستخدمين.", photographerPublished.Body);
        Assert.Equal(NotificationActionTarget.Offer, photographerPublished.ActionTarget);
        Assert.Equal("offer-id", photographerPublished.TargetId);

        var reminder = NotificationCatalog.Render(NotificationKind.ProfessionalOfferReminder24Hours, Language.Arabic, targetId: "offer-id");
        Assert.Equal("بقي 24 ساعة على انتهاء العرض", reminder.Title);
        Assert.Equal("يمكنك مراجعة العرض أو إيقافه قبل موعد انتهائه.", reminder.Body);

        var ended = NotificationCatalog.Render(NotificationKind.ProfessionalOfferEndedForPhotographer, Language.Arabic, targetId: "offer-id");
        Assert.Equal("انتهى عرضك", ended.Title);
        Assert.Equal("لم يعد العرض ظاهرًا ضمن العروض الفعالة للمستخدمين.", ended.Body);

        var edits = NotificationCatalog.Render(NotificationKind.PostEditsSaved, Language.Arabic, targetId: "post-id");
        Assert.Equal("تم حفظ تعديلات المنشور", edits.Title);
        Assert.Equal("تم تحديث المنشور ونشر النسخة المعدلة للجمهور.", edits.Body);
        Assert.Equal(NotificationActionTarget.Post, edits.ActionTarget);
        Assert.Equal("post-id", edits.TargetId);
    }

    [Fact]
    public async Task ApplyTheOfferVisibilityWindowAndApprovalAtQueryTime()
    {
        using var context = CreateContext();
        context.Users.AddRange(
            new Wesal.Infrastructure.Identity.ApplicationUser { Id = "approved", ApprovalStatus = AccountApprovalStatus.Approved },
            new Wesal.Infrastructure.Identity.ApplicationUser { Id = "pending", ApprovalStatus = AccountApprovalStatus.Pending });
        context.ProfessionalOffers.AddRange(
            OfferEntity("approved", Now.AddHours(-1), Now.AddHours(1)),
            OfferEntity("approved", Now.AddHours(1), Now.AddHours(2)),
            OfferEntity("approved", Now.AddHours(-2), Now),
            OfferEntity("pending", Now.AddHours(-1), Now.AddHours(1)),
            new ProfessionalOffer { OwnerUserId = "approved", OldPrice = 100, OfferPrice = 50, StartsAt = Now.AddHours(-1), EndsAt = Now.AddHours(1), StoppedAt = Now });
        await context.SaveChangesAsync();

        var repo = new ProfessionalOfferRepository(context);
        var visible = await repo.ListVisibleByOwnerAsync("approved", Now, 0, 10);
        Assert.Single(visible);
        Assert.Equal("approved", visible[0].OwnerUserId);
    }

    [Fact]
    public async Task ApplyHallOfferWindowAndKeepHallVisibilityRules()
    {
        using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Paid hall", OwnerId = "owner", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        context.Halls.Add(hall);
        context.HallOffers.Add(new HallOffer { HallId = hall.Id, OldBookingPrice = 100, OfferPrice = 80, StartsAt = Now.AddHours(-1), EndsAt = Now.AddHours(1) });
        await context.SaveChangesAsync();
        Assert.NotNull(await new HallOfferRepository(context).GetActiveForHallAsync(hall.Id, Now));
        Assert.Null(await new HallOfferRepository(context).GetActiveForHallAsync(Guid.NewGuid(), Now));
    }

    private static ApplicationDbContext CreateContext()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static OwnerDocumentUpload Image() => new() { FileName = "image.png", ContentType = "image/png", Content = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] };

    private static CreateProfessionalOfferRequest Offer(decimal oldPrice = 100, decimal offerPrice = 70,
        DateTimeOffset? startsAt = null, DateTimeOffset? endsAt = null, string? content = null,
        IReadOnlyList<OwnerDocumentUpload>? images = null)
        => new() { OldPrice = oldPrice, OfferPrice = offerPrice, StartsAt = startsAt ?? Now, EndsAt = endsAt ?? Now.AddDays(2), Content = content, Images = images ?? [] };

    private static ProfessionalOffer OfferEntity(string owner, DateTimeOffset start, DateTimeOffset end)
        => new() { OwnerUserId = owner, OldPrice = 100, OfferPrice = 80, StartsAt = start, EndsAt = end };

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
