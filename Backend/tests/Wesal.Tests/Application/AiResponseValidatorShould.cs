using Wesal.Application.Ai;

namespace Wesal.Tests.Application;

public class AiResponseValidatorShould
{
    private readonly AiResponseValidator _validator = new();

    [Fact]
    public void ValidResponse_Accepted()
    {
        Assert.True(_validator.IsValid("يمكنك تصفح القاعات من صفحة القاعات"));
        Assert.True(_validator.IsValid("You can browse halls"));
    }

    [Fact]
    public void NullResponse_Invalid()
    {
        Assert.False(_validator.IsValid(null));
    }

    [Fact]
    public void EmptyResponse_Invalid()
    {
        Assert.False(_validator.IsValid(""));
    }

    [Fact]
    public void WhitespaceOnlyResponse_Invalid()
    {
        Assert.False(_validator.IsValid("   "));
        Assert.False(_validator.IsValid("\n\t"));
    }

    [Fact]
    public void InvalidStructure_TreatedAsInvalid()
    {
        // Whitespace is the invalid structure we handle; fallback must trigger
        Assert.False(_validator.IsValid(" "));
    }
}
