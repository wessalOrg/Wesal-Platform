using System.ComponentModel.DataAnnotations;

namespace Wesal.Infrastructure.Auth;

public class JwtSettings
{
    public const string SectionName = "Jwt";

    [Required]
    public string Issuer { get; set; } = string.Empty;

    [Required]
    public string Audience { get; set; } = string.Empty;

    [Required]
    [MinLength(32)]
    public string SecretKey { get; set; } = string.Empty;

    [Range(1, 1440)]
    public int ExpirationMinutes { get; set; } = 60;

    [Range(0, 30)]
    public int ClockSkewMinutes { get; set; } = 5;
}
