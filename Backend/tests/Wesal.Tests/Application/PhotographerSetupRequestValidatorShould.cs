using FluentValidation.Results;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

/// <summary>
/// Branch rules of the Photographer setup form (WESAL photographer setup): the studio
/// answer is mandatory, each branch requires exactly its own fields, and the phone rule
/// is the platform's existing convention. File validation lives in the setup service,
/// which receives the buffered bytes.
/// </summary>
public class PhotographerSetupRequestValidatorShould
{
    private static ValidationResult Validate(PhotographerSetupRequest request)
        => new PhotographerSetupRequestValidator().Validate(request);

    private static PhotographerSetupRequest ValidStudioRequest() => new()
    {
        HasStudio = true,
        StudioName = "Noor Studio",
        StudioLocation = "Ramallah, Main Street",
        DetailedStudioLocation = "Al-Irsal Street, next to the bank, second floor",
        PhoneNumber = "+970599111111"
    };

    private static PhotographerSetupRequest ValidNoStudioRequest() => new()
    {
        HasStudio = false,
        FullName = "Ahmad Khalil",
        PhoneNumber = "+970599222222"
    };

    // --- Shared: the mandatory studio answer -----------------------------------------

    [Fact]
    public void MissingStudioAnswer_IsRejected()
    {
        var result = Validate(new PhotographerSetupRequest { PhoneNumber = "+970599111111" });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.HasStudio));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void AnsweredStudioQuestion_IsAcceptedByTheAnswerRule(bool hasStudio)
    {
        var request = hasStudio
            ? ValidStudioRequest()
            : ValidNoStudioRequest();

        Assert.DoesNotContain(
            Validate(request).Errors,
            e => e.PropertyName == nameof(PhotographerSetupRequest.HasStudio));
    }

    // --- Studio branch ----------------------------------------------------------------

    [Fact]
    public void ValidStudioSubmission_PassesValidation()
    {
        var result = Validate(ValidStudioRequest());

        Assert.True(result.IsValid, string.Join("; ", result.Errors.Select(e => e.ErrorMessage)));
    }

    [Theory]
    [InlineData(nameof(PhotographerSetupRequest.StudioName))]
    [InlineData(nameof(PhotographerSetupRequest.StudioLocation))]
    [InlineData(nameof(PhotographerSetupRequest.DetailedStudioLocation))]
    public void MissingStudioField_IsRejected(string field)
    {
        var valid = ValidStudioRequest();
        var request = new PhotographerSetupRequest
        {
            HasStudio = true,
            StudioName = field == nameof(PhotographerSetupRequest.StudioName) ? null : valid.StudioName,
            StudioLocation = field == nameof(PhotographerSetupRequest.StudioLocation) ? null : valid.StudioLocation,
            DetailedStudioLocation = field == nameof(PhotographerSetupRequest.DetailedStudioLocation) ? null : valid.DetailedStudioLocation,
            PhoneNumber = valid.PhoneNumber
        };

        var result = Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == field);
    }

    [Theory]
    [InlineData(nameof(PhotographerSetupRequest.StudioName))]
    [InlineData(nameof(PhotographerSetupRequest.StudioLocation))]
    [InlineData(nameof(PhotographerSetupRequest.DetailedStudioLocation))]
    public void WhitespaceOnlyStudioField_IsRejected(string field)
    {
        var valid = ValidStudioRequest();
        var request = new PhotographerSetupRequest
        {
            HasStudio = true,
            StudioName = field == nameof(PhotographerSetupRequest.StudioName) ? "   " : valid.StudioName,
            StudioLocation = field == nameof(PhotographerSetupRequest.StudioLocation) ? "   " : valid.StudioLocation,
            DetailedStudioLocation = field == nameof(PhotographerSetupRequest.DetailedStudioLocation) ? "   " : valid.DetailedStudioLocation,
            PhoneNumber = valid.PhoneNumber
        };

        var result = Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == field);
    }

    [Fact]
    public void StudioSubmission_DoesNotRequireTheNoStudioFullName()
    {
        var result = Validate(ValidStudioRequest());

        Assert.DoesNotContain(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.FullName));
    }

    [Fact]
    public void StudioSubmission_UsesTheSharedPhoneRule()
    {
        var valid = ValidStudioRequest();
        var request = new PhotographerSetupRequest
        {
            HasStudio = true,
            StudioName = valid.StudioName,
            StudioLocation = valid.StudioLocation,
            DetailedStudioLocation = valid.DetailedStudioLocation,
            PhoneNumber = "not-a-phone"
        };

        var result = Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.PhoneNumber));
    }

    // --- No-studio branch -------------------------------------------------------------

    [Fact]
    public void ValidNoStudioSubmission_PassesValidation()
    {
        var result = Validate(ValidNoStudioRequest());

        Assert.True(result.IsValid, string.Join("; ", result.Errors.Select(e => e.ErrorMessage)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void MissingOrWhitespaceFullName_IsRejected(string? fullName)
    {
        var result = Validate(new PhotographerSetupRequest
        {
            HasStudio = false,
            FullName = fullName,
            PhoneNumber = "+970599222222"
        });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.FullName));
    }

    [Fact]
    public void NoStudioSubmission_DoesNotRequireStudioFields()
    {
        var result = Validate(ValidNoStudioRequest());

        Assert.DoesNotContain(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.StudioName));
        Assert.DoesNotContain(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.StudioLocation));
        Assert.DoesNotContain(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.DetailedStudioLocation));
    }

    // --- Shared phone rule ------------------------------------------------------------

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void MissingPhone_IsRejectedForBothBranches(bool hasStudio)
    {
        var request = hasStudio
            ? new PhotographerSetupRequest
            {
                HasStudio = true,
                StudioName = "Noor Studio",
                StudioLocation = "Ramallah",
                DetailedStudioLocation = "Al-Irsal Street"
            }
            : new PhotographerSetupRequest { HasStudio = false, FullName = "Ahmad Khalil" };

        var result = Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.PhoneNumber));
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("+")]
    [InlineData("059")]
    [InlineData("++970599111111")]
    public void MalformedPhone_IsRejected(string phone)
    {
        var valid = ValidStudioRequest();
        var result = Validate(new PhotographerSetupRequest
        {
            HasStudio = true,
            StudioName = valid.StudioName,
            StudioLocation = valid.StudioLocation,
            DetailedStudioLocation = valid.DetailedStudioLocation,
            PhoneNumber = phone
        });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(PhotographerSetupRequest.PhoneNumber));
    }

    [Theory]
    [InlineData("+970599111111")]
    [InlineData("0599111111")]
    [InlineData("+1 555-123-4567")]
    public void PlatformConventionalPhones_AreAccepted(string phone)
    {
        var valid = ValidNoStudioRequest();
        var result = Validate(new PhotographerSetupRequest
        {
            HasStudio = false,
            FullName = valid.FullName,
            PhoneNumber = phone
        });

        Assert.True(result.IsValid, string.Join("; ", result.Errors.Select(e => e.ErrorMessage)));
    }
}
