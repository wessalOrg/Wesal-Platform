namespace Wesal.Infrastructure.Halls;

public interface IHallMediaStorage
{
    string Root { get; }

    string HallsUploadDirectory(Guid hallId);
}