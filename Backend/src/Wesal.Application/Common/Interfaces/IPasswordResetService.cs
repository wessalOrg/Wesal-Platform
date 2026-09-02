using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IPasswordResetService
{
    Task<ForgotPasswordResponse> ForgotPasswordAsync(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken = default);

    Task<ResetPasswordResponse> ResetPasswordAsync(
        ResetPasswordRequest request,
        CancellationToken cancellationToken = default);
}