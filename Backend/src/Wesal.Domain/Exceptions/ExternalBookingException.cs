namespace Wesal.Domain.Exceptions;

public sealed class ExternalBookingException(int statusCode, string code, string message) : DomainException(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}
