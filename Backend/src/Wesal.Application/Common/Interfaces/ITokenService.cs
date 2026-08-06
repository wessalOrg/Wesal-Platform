namespace Wesal.Application.Common.Interfaces;

public interface ITokenService
{
    string CreateToken(string userId, string userName, string email, IEnumerable<string> roles);
}
