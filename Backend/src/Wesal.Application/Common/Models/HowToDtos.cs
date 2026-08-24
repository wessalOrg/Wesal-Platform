namespace Wesal.Application.Common.Models;

public sealed record HowToRequest(string? Question);

public sealed record HowToResponse(
    string Answer,
    string Category,
    DateTime Timestamp);
