using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class WesalKnowledgeServiceShould
{
    private readonly IWesalKnowledgeService _service = new WesalKnowledgeService();

    [Fact]
    public async Task Documents_LoadSuccessfully_NonEmpty()
    {
        var articles = await _service.SearchAsync("وصال", "ar", 10);

        Assert.NotEmpty(articles);
    }

    [Fact]
    public async Task ArabicQuestion_WhatIsWesal_ReturnsPlatformDescription()
    {
        var articles = await _service.SearchAsync("شو هي وصال؟", "ar", 5);

        Assert.NotEmpty(articles);
        var about = Assert.Single(articles, a => a.Category == "platform" && a.Title.Contains("about", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("وصال", about.Content);
        Assert.Contains("\u0645\u0646\u0633\u0642\u064a \u0627\u0644\u0623\u0641\u0631\u0627\u062d", about.Content, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(WesalKnowledgeStatus.NeedsVerification, about.Status);
    }

    [Fact]
    public async Task EnglishQuestion_WhatIsWesal_ReturnsPlatformDescription()
    {
        var articles = await _service.SearchAsync("what is wesal", "en", 5);

        Assert.NotEmpty(articles);
        var about = Assert.Single(articles, a => a.Title.Contains("about", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("Wesal", about.Content);
        Assert.Contains("wedding planners", about.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ArabicQuestion_TeamDevelopers_ReturnsTeamInfo()
    {
        var articles = await _service.SearchAsync("مين مطورين وصال", "ar", 5);

        Assert.NotEmpty(articles);
        var team = Assert.Single(articles, a => a.Category == "platform" && a.Title.Contains("team", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("\u0645\u062d\u0645\u062f \u0634\u0645\u0639\u0629", team.Content);
        Assert.Contains("\u0639\u0628\u062f \u0627\u0644\u0639\u0632\u064a\u0632", team.Content);
    }

    [Fact]
    public async Task EnglishQuestion_WhoAreDevelopers_ReturnsPrimaryDevs()
    {
        var articles = await _service.SearchAsync("who are the primary developers", "en", 5);

        Assert.NotEmpty(articles);
        var team = Assert.Single(articles, a => a.Title.Contains("team", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("Abdulaziz Al-Khazendar", team.Content);
        Assert.Contains("Mohammed Shama", team.Content);
    }

    [Fact]
    public async Task TeamQuestion_IncludesTechnicalTeamMembers()
    {
        var articles = await _service.SearchAsync("من فريق وصال التقني", "ar", 5);

        Assert.NotEmpty(articles);
        var team = articles.First(a => a.Category == "platform");
        Assert.Contains("\u0622\u0644\u0627\u0621 \u0634\u0631\u0641", team.Content);
        Assert.Contains("\u0644\u064a\u0644\u064a\u0627\u0646 \u0635\u0644\u0627\u062d", team.Content);
        Assert.Contains("\u0645\u0631\u062d \u0639\u0628\u064a\u062f", team.Content);
    }

    [Fact]
    public async Task PrimaryDevs_AreSeparateFromTechTeam()
    {
        var articles = await _service.SearchAsync("developers wesal", "en", 5);

        Assert.NotEmpty(articles);
        var team = articles.First(a => a.Title.Contains("team", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("Abdulaziz Al-Khazendar", team.Content);
        Assert.Contains("Alaa Sharaf", team.Content);
    }

    [Fact]
    public async Task ArabicContact_WhatsApp_ReturnsContactNumber()
    {
        var articles = await _service.SearchAsync("شو رقم واتساب وصال", "ar", 5);

        Assert.NotEmpty(articles);
        var contact = Assert.Single(articles, a => a.Category == "platform" && a.Title.Contains("contact", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("+970567581412", contact.Content);
        Assert.Equal(WesalKnowledgeStatus.Verified, contact.Status);
    }

    [Fact]
    public async Task EnglishContact_ReturnsOfficialNumbers()
    {
        var articles = await _service.SearchAsync("wesal contact support", "en", 5);

        Assert.NotEmpty(articles);
        var contact = Assert.Single(articles, a => a.Category == "platform" && a.Title.Contains("contact", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("0598150426", contact.Content);
        Assert.Contains("590 774 4476", contact.Content);
        Assert.Contains("wesal.platform.gaza@gmail.com", contact.Content);
    }

    [Fact]
    public async Task SupportHours_ReturnsHours()
    {
        var articles = await _service.SearchAsync("ساعات الدعم", "ar", 5);

        Assert.NotEmpty(articles);
        var hours = Assert.Single(articles, a => a.Title.Contains("support hours", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("9:00", hours.Content);
        Assert.Contains("6:00", hours.Content);
    }

    [Fact]
    public async Task EnglishFAQ_PriceQuestion_ReturnsVariesAnswer()
    {
        var articles = await _service.SearchAsync("how much does wesal cost", "en", 5);

        Assert.NotEmpty(articles);
        var faq = Assert.Single(articles, a => a.Category == "faq");
        Assert.Contains("varies", faq.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ArabicFAQ_PriceDoesNotInventPrice()
    {
        var articles = await _service.SearchAsync("كم سعر وصال", "ar", 5);

        Assert.NotEmpty(articles);
        var faq = Assert.Single(articles, a => a.Category == "faq");
        Assert.Contains("يختلف", faq.Content);
        Assert.DoesNotContain("شيكل", faq.Content);
        Assert.DoesNotContain("دولار", faq.Content);
    }

    [Fact]
    public async Task PlatformDescription_NotLimitedToWeddingHalls()
    {
        var articles = await _service.SearchAsync("what is wesal platform", "en", 5);

        Assert.NotEmpty(articles);
        var about = Assert.Single(articles, a => a.Title.Contains("about", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("wedding planners", about.Content, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("photography studios", about.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BookingGuidance_ReturnsBookingInfo()
    {
        var articles = await _service.SearchAsync("book hall wesal", "en", 5);

        Assert.NotEmpty(articles);
        var booking = Assert.Single(articles, a => a.Category == "user-guide" && a.Title.Contains("Booking", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("book", booking.Content, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("deposit", booking.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RatingRules_ReturnsCorrectRule()
    {
        var articles = await _service.SearchAsync("rate hall", "en", 5);

        Assert.NotEmpty(articles);
        var ratings = Assert.Single(articles, a => a.Category == "user-guide" && a.Title.Contains("rating", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("booked", ratings.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CommentRules_ReturnsCorrectRule()
    {
        var articles = await _service.SearchAsync("comment hall", "en", 5);

        Assert.NotEmpty(articles);
        var comments = Assert.Single(articles, a => a.Category == "user-guide" && a.Title.Contains("comment", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("logged-in user", comments.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Privacy_ReturnsPolicyInfo()
    {
        var articles = await _service.SearchAsync("privacy policy", "en", 5);

        Assert.NotEmpty(articles);
        var privacy = Assert.Single(articles, a => a.Category == "policies");
        Assert.Contains("privacy", privacy.Content, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(WesalKnowledgeStatus.NeedsVerification, privacy.Status);
    }

    [Fact]
    public async Task CancellationRules_ReturnsInfo()
    {
        var articles = await _service.SearchAsync("cancel booking", "en", 5);

        Assert.NotEmpty(articles);
        var cancellation = Assert.Single(articles, a => a.Category == "user-guide" && a.Title.Contains("cancellation", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("deposit", cancellation.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ArabicCancellation_ReturnsInfo()
    {
        var articles = await _service.SearchAsync("إلغاء حجز", "ar", 5);

        Assert.NotEmpty(articles);
        var cancellation = Assert.Single(articles, a => a.Title.Contains("cancellation", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("العربون", cancellation.Content);
    }

    [Fact]
    public async Task RegistrationGuide_ReturnsInfo()
    {
        var articles = await _service.SearchAsync("register account", "en", 5);

        Assert.NotEmpty(articles);
        var reg = Assert.Single(articles, a => a.Category == "user-guide" && a.Title.Contains("Registration", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("password", reg.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UnrecognizedQuestion_ReturnsEmptyList()
    {
        var articles = await _service.SearchAsync("quantum physics entanglement", "en", 5);

        Assert.Empty(articles);
    }

    [Fact]
    public async Task MissingInfo_DoesNotHallucinate()
    {
        var articles = await _service.SearchAsync("what is wesal price for photography session", "en", 5);

        Assert.NotEmpty(articles);
        var faq = articles.FirstOrDefault(a => a.Category == "faq");
        Assert.NotNull(faq);
        Assert.Contains("varies", faq!.Content, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("shekel", faq.Content, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ILS", faq.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Status_ReflectedCorrectlyInArticles()
    {
        var articles = await _service.SearchAsync("wesal", "en", 10);

        Assert.Contains(articles, a => a.Title.Contains("contact", StringComparison.OrdinalIgnoreCase) && a.Status == WesalKnowledgeStatus.Verified);
        Assert.Contains(articles, a => a.Title.Contains("about", StringComparison.OrdinalIgnoreCase) && a.Status == WesalKnowledgeStatus.NeedsVerification);
    }

    [Fact]
    public async Task LocalizedContent_Arabic_DoesNotContainEnglishSection()
    {
        var articles = await _service.SearchAsync("من وصال", "ar", 3);

        Assert.NotEmpty(articles);
        var article = articles.First();
        Assert.DoesNotContain("## English", article.Content);
    }

    [Fact]
    public async Task LocalizedContent_English_DoesNotContainArabicSection()
    {
        var articles = await _service.SearchAsync("what is wesal", "en", 3);

        Assert.NotEmpty(articles);
        var article = articles.First();
        Assert.DoesNotContain("## \u0627\u0644\u0639\u0631\u0628\u064a\u0629", article.Content);
    }

    [Fact]
    public async Task SearchAsync_BoundsResultsByMax()
    {
        var articles = await _service.SearchAsync("wesal", "en", 2);

        Assert.True(articles.Count <= 2);
    }

    [Fact]
    public async Task NullLanguage_DoesNotThrow()
    {
        var articles = await _service.SearchAsync("wesal", null, 2);

        Assert.NotNull(articles);
    }

    [Fact]
    public async Task EmptyQuestion_ReturnsEmptyList()
    {
        var articles = await _service.SearchAsync("", "ar", 5);

        Assert.Empty(articles);
    }
}