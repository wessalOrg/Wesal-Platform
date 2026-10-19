using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Queries;

/// <summary>Canonical SQL-translatable definition of a public professional account.</summary>
public static class PublicProfessionalVisibility
{
    public static IQueryable<ApplicationUser> VisibleToPublic(
        this IQueryable<ApplicationUser> users, ApplicationDbContext db, DateTimeOffset now)
        => users.Where(user => user.ApprovalStatus == AccountApprovalStatus.Approved
            && !db.AccountLocks.Any(lockRow => lockRow.UserId == user.Id
                && lockRow.LiftedAt == null && lockRow.StartsAt <= now && now < lockRow.EndsAt));
}
