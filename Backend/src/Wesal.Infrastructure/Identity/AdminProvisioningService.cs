using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Wesal.Domain.Constants;

namespace Wesal.Infrastructure.Identity;

/// <summary>
/// Idempotent admin account provisioning.
///
/// For every configured entry:
///  - the account does not exist  -> it is created (via Identity, so the
///    password is hashed by the same PasswordHasher used everywhere) and the
///    Admin role is assigned;
///  - the account exists without Admin -> only the Admin role is added;
///  - the account already has Admin -> it is left completely intact.
///
/// Existing passwords, profile fields, halls, bookings and subscriptions are
/// never touched. Creation requires the entry to carry a password, which will
/// always arrive from a runtime environment override rather than a committed
/// source.
/// </summary>
public sealed class AdminProvisioningService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly ILogger<AdminProvisioningService> _logger;

    public AdminProvisioningService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        ILogger<AdminProvisioningService> logger)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _logger = logger;
    }

    public async Task RunAsync(IReadOnlyList<AdminProvisioningEntry> admins, CancellationToken cancellationToken = default)
    {
        if (admins.Count == 0)
        {
            return;
        }

        await EnsureRoleExistsAsync(cancellationToken);

        foreach (var entry in admins)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await ProvisionAsync(entry, cancellationToken);
        }
    }

    private async Task ProvisionAsync(AdminProvisioningEntry entry, CancellationToken cancellationToken)
    {
        var email = entry.Email?.Trim() ?? string.Empty;
        if (email.Length == 0)
        {
            return;
        }

        try
        {
            var existing = await _userManager.FindByEmailAsync(email);

            if (existing is null)
            {
                await CreateAdminAsync(entry, email, cancellationToken);
                return;
            }

            if (!await _userManager.IsInRoleAsync(existing, ApplicationRoles.Admin))
            {
                var addResult = await _userManager.AddToRoleAsync(existing, ApplicationRoles.Admin);
                if (!addResult.Succeeded)
                {
                    _logger.LogError(
                        "Admin provisioning: failed to grant the Admin role to {Email}: {Errors}.",
                        email,
                        string.Join("; ", addResult.Errors.Select(error => error.Description)));
                    return;
                }

                _logger.LogInformation("Admin provisioning: granted the Admin role to the existing account {Email}.", email);
                return;
            }

            _logger.LogInformation("Admin provisioning: {Email} already holds the Admin role; no changes made.", email);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Admin provisioning: unexpected error while provisioning {Email}.", email);
        }
    }

    private async Task CreateAdminAsync(AdminProvisioningEntry entry, string email, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(entry.Password))
        {
            _logger.LogWarning(
                "Admin provisioning: no password supplied for {Email}; the account was not created. " +
                "Provide the password via the AdminProvisioning__Admins__N__Password environment override.",
                email);
            return;
        }

        var user = new ApplicationUser
        {
            FullName = string.IsNullOrWhiteSpace(entry.FullName) ? email : entry.FullName.Trim(),
            Email = email,
            UserName = email
        };

        var createResult = await _userManager.CreateAsync(user, entry.Password);
        if (!createResult.Succeeded)
        {
            _logger.LogError(
                "Admin provisioning: failed to create {Email}: {Errors}.",
                email,
                string.Join("; ", createResult.Errors.Select(error => error.Description)));
            return;
        }

        var roleResult = await _userManager.AddToRoleAsync(user, ApplicationRoles.Admin);
        if (!roleResult.Succeeded)
        {
            _logger.LogError(
                "Admin provisioning: created {Email} but could not assign the Admin role: {Errors}.",
                email,
                string.Join("; ", roleResult.Errors.Select(error => error.Description)));
            return;
        }

        _logger.LogInformation("Admin provisioning: created admin account {Email}.", email);
    }

    private async Task EnsureRoleExistsAsync(CancellationToken cancellationToken)
    {
        if (await _roleManager.RoleExistsAsync(ApplicationRoles.Admin))
        {
            return;
        }

        var createResult = await _roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.Admin));
        if (!createResult.Succeeded)
        {
            _logger.LogError(
                "Admin provisioning: failed to create the Admin role: {Errors}.",
                string.Join("; ", createResult.Errors.Select(error => error.Description)));
        }
    }
}