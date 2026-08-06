using Wesal.Domain.Exceptions;

namespace Wesal.Tests.Domain;

public class DomainExceptionsShould
{
    [Fact]
    public void BusinessRuleException_PreservesCodeAndMessage()
    {
        var exception = new BusinessRuleException("HallNotApproved", "Hall must be approved first.");

        Assert.Equal("HallNotApproved", exception.Code);
        Assert.Equal("Hall must be approved first.", exception.Message);
        Assert.IsAssignableFrom<DomainException>(exception);
    }

    [Fact]
    public void NotFoundException_FormatsMessageWithNameAndKey()
    {
        var exception = new NotFoundException("Hall", Guid.Parse("00000000-0000-0000-0000-000000000001"));

        Assert.Equal("Entity \"Hall\" (00000000-0000-0000-0000-000000000001) was not found.", exception.Message);
    }

    [Fact]
    public void ValidationException_ExposesErrors()
    {
        var errors = new Dictionary<string, string[]>
        {
            ["Email"] = ["'Email' must not be empty."]
        };

        var exception = new ValidationException(errors);

        Assert.True(exception.Errors.ContainsKey("Email"));
        Assert.Equal("'Email' must not be empty.", exception.Errors["Email"].Single());
    }
}
