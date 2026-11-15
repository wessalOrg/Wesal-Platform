namespace Wesal.Domain.Exceptions;

public sealed class TooManyRequestsException(string message) : DomainException(message);
