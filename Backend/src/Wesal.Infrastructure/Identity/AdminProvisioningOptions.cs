namespace Wesal.Infrastructure.Identity;

/// <summary>
/// Runtime-only admin account provisioning settings.
///
/// The section is inert unless <see cref="Enabled"/> is true. Passwords are
/// supplied exclusively through environment overrides
/// (e.g. AdminProvisioning__Admins__0__Password) at startup and are never read
/// from committed configuration files.
/// </summary>
public sealed class AdminProvisioningOptions
{
    public const string SectionName = "AdminProvisioning";

    public bool Enabled { get; set; }

    public List<AdminProvisioningEntry> Admins { get; set; } = [];
}

public sealed class AdminProvisioningEntry
{
    public string Email { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}