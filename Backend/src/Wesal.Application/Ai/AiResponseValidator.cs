namespace Wesal.Application.Ai;

public interface IAiResponseValidator
{
    bool IsValid(string? response);
}

public sealed class AiResponseValidator : IAiResponseValidator
{
    public bool IsValid(string? response)
    {
        if (response is null) return false;
        if (string.IsNullOrWhiteSpace(response)) return false;
        // Consider response invalid if it's only whitespace or extremely short generic error leaked
        // We treat any non-empty, non-whitespace as valid structure; deeper validation handled by fallback
        return true;
    }
}
