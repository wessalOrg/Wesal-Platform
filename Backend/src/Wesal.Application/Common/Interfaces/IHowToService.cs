using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHowToService
{
    Task<HowToResponse> AskHowToAsync(string question, string? language, CancellationToken cancellationToken = default);
}
