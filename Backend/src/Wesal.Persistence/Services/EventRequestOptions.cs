namespace Wesal.Persistence.Services;

public sealed class EventRequestOptions
{
    public const string SectionName = "EventRequests";
    public int MaxPerHour { get; set; } = 5;
    public int DuplicateWindowMinutes { get; set; } = 15;
    public int FanoutBatchSize { get; set; } = 100;
}
