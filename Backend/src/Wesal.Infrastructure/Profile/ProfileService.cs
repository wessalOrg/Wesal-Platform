using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Profile;

public sealed class ProfileService : IProfileService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;

    public ProfileService(UserManager<ApplicationUser> userManager, ICurrentUserService currentUser)
    {
        _userManager = userManager;
        _currentUser = currentUser;
    }

    public async Task<ProfileResponse> GetProfileAsync(CancellationToken cancellationToken = default)
    {
        var user = await GetCurrentUserAsync(cancellationToken);
        return new ProfileResponse
        {
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            PhoneNumber = user.PhoneNumber ?? string.Empty,
            ConcurrencyStamp = user.ConcurrencyStamp ?? string.Empty
        };
    }

    public async Task<ProfileResponse> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        var user = await GetCurrentUserAsync(cancellationToken);

        // Concurrency check - if client provided stamp, verify it matches current
        if (request.ConcurrencyStamp is not null && request.ConcurrencyStamp != user.ConcurrencyStamp)
        {
            throw new ConflictException("Profile has been modified by another request. Please refresh and try again.");
        }

        // Server-side validation (reuse registration rules)
        var validationErrors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.FullName))
            validationErrors["FullName"] = new[] { "Full name is required." };
        else if (request.FullName.Trim().Length > 150)
            validationErrors["FullName"] = new[] { "Full name cannot exceed 150 characters." };

        if (string.IsNullOrWhiteSpace(request.Email))
            validationErrors["Email"] = new[] { "Email is required." };
        else
        {
            try { var addr = new System.Net.Mail.MailAddress(request.Email); if (addr.Address != request.Email.Trim()) throw new Exception(); }
            catch { validationErrors["Email"] = new[] { "A valid email address is required." }; }
            if (request.Email.Length > 256)
                validationErrors["Email"] = new[] { "Email cannot exceed 256 characters." };
        }

        if (string.IsNullOrWhiteSpace(request.PhoneNumber))
            validationErrors["PhoneNumber"] = new[] { "Phone number is required." };
        else if (!System.Text.RegularExpressions.Regex.IsMatch(request.PhoneNumber.Trim(), @"^\+?[0-9][0-9\s\-]{6,19}$"))
            validationErrors["PhoneNumber"] = new[] { "A valid phone number is required." };

        if (validationErrors.Count > 0)
            throw new ValidationException(validationErrors);

        // Duplicate email check (exclude current user)
        var normalizedEmail = request.Email.Trim();
        var existingByEmail = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existingByEmail is not null && !string.Equals(existingByEmail.Id, user.Id, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Email is already in use.");
        }

        // Duplicate phone check (exclude current user)
        var normalizedPhone = request.PhoneNumber.Trim();
        var existingByPhone = await _userManager.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.PhoneNumber == normalizedPhone, cancellationToken);
        if (existingByPhone is not null && !string.Equals(existingByPhone.Id, user.Id, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Phone number is already in use.");
        }

        // Validate all before applying (atomicity) - update all fields together
        user.FullName = request.FullName.Trim();
        user.Email = normalizedEmail;
        user.UserName = normalizedEmail;
        user.PhoneNumber = normalizedPhone;
        // Keep ConcurrencyStamp for EF concurrency check
        if (request.ConcurrencyStamp is not null)
            user.ConcurrencyStamp = request.ConcurrencyStamp;

        IdentityResult result;
        try
        {
            result = await _userManager.UpdateAsync(user);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("Profile has been modified by another request. Please refresh and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("PhoneNumber") == true || ex.Message.Contains("PhoneNumber"))
        {
            throw new ConflictException("Phone number is already in use.");
        }

        if (!result.Succeeded)
        {
            // Check for concurrency failure
            if (result.Errors.Any(e => e.Code.Contains("Concurrency")))
                throw new ConflictException("Profile has been modified by another request. Please refresh and try again.");

            // Check for duplicate email/phone from Identity
            if (result.Errors.Any(e => e.Code is "DuplicateUserName" or "DuplicateEmail"))
                throw new ConflictException("Email is already in use.");

            var errors = result.Errors.GroupBy(e => e.Code)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());
            throw new ValidationException(errors);
        }

        // Reload to get new ConcurrencyStamp
        var updated = await _userManager.FindByIdAsync(user.Id);
        if (updated is null)
            throw new NotFoundException("User", user.Id);

        return new ProfileResponse
        {
            FullName = updated.FullName,
            Email = updated.Email ?? string.Empty,
            PhoneNumber = updated.PhoneNumber ?? string.Empty,
            ConcurrencyStamp = updated.ConcurrencyStamp ?? string.Empty
        };
    }

    private async Task<ApplicationUser> GetCurrentUserAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to access your profile.");

        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
            throw new NotFoundException("User", _currentUser.UserId);

        return user;
    }
}
