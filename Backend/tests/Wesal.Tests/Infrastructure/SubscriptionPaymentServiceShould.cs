using Microsoft.Extensions.Options;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Tests verifying the subscription payment contact contract (US-AI-08).
/// Ensures the canonical contact is sourced from backend-controlled configuration,
/// never from AI-generated content.
/// </summary>
public class SubscriptionPaymentServiceShould
{
    private static readonly SubscriptionPaymentOptions DefaultOptions = new();
    private static readonly IOptions<SubscriptionPaymentOptions> DefaultOptionsWrapper = Options.Create(DefaultOptions);

    [Fact]
    public void GetAdminWhatsAppContact_ReturnsCanonicalContact()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var contact = service.GetAdminWhatsAppContact();

        Assert.Equal("+972597744476", contact);
    }

    [Fact]
    public void GetPaymentDetails_ReturnsCorrectContact()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var details = service.GetPaymentDetails();

        Assert.Equal("+972597744476", details.AdminWhatsAppContact);
    }

    [Fact]
    public void GetPaymentDetails_ReturnsCorrectPrice()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var details = service.GetPaymentDetails();

        Assert.Equal(120m, details.SubscriptionPriceIls);
    }

    [Fact]
    public void GetPaymentDetails_ReturnsCorrectCycleDays()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var details = service.GetPaymentDetails();

        Assert.Equal(30, details.SubscriptionCycleDays);
    }

    [Fact]
    public void GetPaymentDetails_ContainsAllRequiredFields()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var details = service.GetPaymentDetails();

        Assert.NotNull(details.AdminWhatsAppContact);
        Assert.True(details.SubscriptionPriceIls > 0);
        Assert.True(details.SubscriptionCycleDays > 0);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_English_ReturnsEnglishResponseLanguage()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("en", CancellationToken.None);

        Assert.Equal("en", response.ResponseLanguage);
        Assert.Equal("subscription-payment", response.Category);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_Arabic_ReturnsArabicResponseLanguage()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("ar", CancellationToken.None);

        Assert.Equal("ar", response.ResponseLanguage);
        Assert.Equal("subscription-payment", response.Category);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_NullLanguage_DefaultsToArabic()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync(null, CancellationToken.None);

        Assert.Equal("ar", response.ResponseLanguage);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_EnglishAnswer_ContainsCanonicalContact()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("en", CancellationToken.None);

        Assert.Contains("+972597744476", response.Answer);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_ArabicAnswer_ContainsCanonicalContact()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("ar", CancellationToken.None);

        Assert.Contains("+972597744476", response.Answer);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_TrustedContact_HasCorrectPhoneNumber()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("en", CancellationToken.None);

        Assert.Equal("+972597744476", response.TrustedContact.PhoneNumber);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_TrustedContact_HasWhatsAppLink()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("en", CancellationToken.None);

        Assert.StartsWith("https://wa.me/", response.TrustedContact.WhatsAppLink);
        Assert.Contains("972597744476", response.TrustedContact.WhatsAppLink);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_TrustedContact_IsAdminWhatsAppType()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("en", CancellationToken.None);

        Assert.Equal("admin-whatsapp", response.TrustedContact.ContactType);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_EnglishAnswer_ContainsPrice()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("en", CancellationToken.None);

        Assert.Contains("120", response.Answer);
        Assert.Contains("ILS", response.Answer);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_ArabicAnswer_ContainsPrice()
    {
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("ar", CancellationToken.None);

        Assert.Contains("120", response.Answer);
        Assert.Contains("شيكل", response.Answer);
    }

    [Fact]
    public async Task GetSubscriptionPaymentResponse_HasTimestamp()
    {
        var before = DateTime.UtcNow;
        var service = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var response = await service.GetSubscriptionPaymentResponseAsync("en", CancellationToken.None);
        var after = DateTime.UtcNow;

        Assert.True(response.Timestamp >= before.AddSeconds(-1));
        Assert.True(response.Timestamp <= after.AddSeconds(1));
    }

    [Fact]
    public void CanonicalContact_IsSingleSourceOfTruth()
    {
        var service1 = new SubscriptionPaymentService(DefaultOptionsWrapper);
        var service2 = new SubscriptionPaymentService(DefaultOptionsWrapper);

        var contact1 = service1.GetAdminWhatsAppContact();
        var contact2 = service2.GetAdminWhatsAppContact();

        Assert.Equal(contact1, contact2);
        Assert.Equal("+972597744476", contact1);
    }

    [Fact]
    public void DefaultOptions_HasCorrectDefaults()
    {
        var options = new SubscriptionPaymentOptions();

        Assert.Equal("+972597744476", options.AdminWhatsAppContact);
        Assert.Equal(120m, options.SubscriptionPriceIls);
        Assert.Equal(30, options.SubscriptionCycleDays);
    }

    [Fact]
    public void DefaultOptions_SectionName_IsCorrect()
    {
        Assert.Equal("SubscriptionPayment", SubscriptionPaymentOptions.SectionName);
    }
}
