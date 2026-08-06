using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Time;

public class DateTimeService : IDateTime
{
    public DateTimeOffset Now => DateTimeOffset.UtcNow;
}
