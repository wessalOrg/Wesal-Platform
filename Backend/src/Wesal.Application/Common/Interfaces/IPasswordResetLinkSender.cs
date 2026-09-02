namespace Wesal.Application.Common.Interfaces;

public interface IPasswordResetLinkSender
{
    Task SendResetLinkAsync(string email, string resetLink, CancellationToken cancellationToken = default);
}