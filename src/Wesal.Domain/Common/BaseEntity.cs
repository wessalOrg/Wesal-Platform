namespace Wesal.Domain.Common;

public abstract class BaseEntity : IAggregateRoot
{
    public Guid Id { get; set; } = Guid.NewGuid();
}
