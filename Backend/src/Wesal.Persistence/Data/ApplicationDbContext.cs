using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.Identity;

namespace Wesal.Persistence.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, string>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Hall> Halls => Set<Hall>();

    public DbSet<HallBookingPeriod> HallBookingPeriods => Set<HallBookingPeriod>();

    public DbSet<HallAvailability> HallAvailabilities => Set<HallAvailability>();

    public DbSet<Rating> Ratings => Set<Rating>();

    public DbSet<Comment> Comments => Set<Comment>();

    public DbSet<Conversation> Conversations => Set<Conversation>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.HasDefaultSchema("wesal");

        builder.Entity<ApplicationUser>().ToTable("AspNetUsers");
        builder.Entity<ApplicationRole>().ToTable("AspNetRoles");

        builder.Entity<IdentityUserRole<string>>().ToTable("AspNetUserRoles");
        builder.Entity<IdentityUserClaim<string>>().ToTable("AspNetUserClaims");
        builder.Entity<IdentityUserLogin<string>>().ToTable("AspNetUserLogins");
        builder.Entity<IdentityRoleClaim<string>>().ToTable("AspNetRoleClaims");
        builder.Entity<IdentityUserToken<string>>().ToTable("AspNetUserTokens");

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(user => user.FullName).HasMaxLength(150);
        });

        builder.Entity<Hall>(entity =>
        {
            entity.ToTable("Halls");

            entity.Property(hall => hall.Name).IsRequired().HasMaxLength(200);
            entity.Property(hall => hall.MainImageUrl).HasMaxLength(500);
            entity.Property(hall => hall.ContactPhone).HasMaxLength(30);
            entity.Property(hall => hall.Address).IsRequired().HasMaxLength(500);
            entity.Property(hall => hall.Description).HasMaxLength(2000);
            entity.Property(hall => hall.Price).HasPrecision(12, 2);

            entity.HasIndex(hall => hall.Status);
            entity.HasIndex(hall => new { hall.Status, hall.IsDeleted });
            entity.HasIndex(hall => hall.Region);
        });

        builder.Entity<HallBookingPeriod>(entity =>
        {
            entity.ToTable("HallBookingPeriods");

            entity.Property(period => period.StartTime).HasColumnType("time");
            entity.Property(period => period.EndTime).HasColumnType("time");

            entity.HasIndex(period => new { period.HallId, period.Type }).IsUnique();

            entity.HasOne(period => period.Hall)
                .WithMany(hall => hall.BookingPeriods)
                .HasForeignKey(period => period.HallId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<HallAvailability>(entity =>
        {
            entity.ToTable("HallAvailabilities");

            entity.Property(availability => availability.Date).HasColumnType("date");

            entity.HasIndex(availability => new { availability.HallId, availability.Date, availability.PeriodType }).IsUnique();

            entity.HasOne(availability => availability.Hall)
                .WithMany(hall => hall.Availability)
                .HasForeignKey(availability => availability.HallId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Rating>(entity =>
        {
            entity.ToTable("Ratings");

            entity.Property(rating => rating.UserId).IsRequired().HasMaxLength(450);
            entity.ToTable(table => table.HasCheckConstraint("CK_Ratings_Value", "\"Value\" BETWEEN 1 AND 5"));
            entity.HasIndex(rating => new { rating.HallId, rating.UserId }).IsUnique();

            entity.HasOne(rating => rating.Hall)
                .WithMany(hall => hall.Ratings)
                .HasForeignKey(rating => rating.HallId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(rating => rating.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Comment>(entity =>
        {
            entity.ToTable("Comments");

            entity.Property(comment => comment.UserId).IsRequired().HasMaxLength(450);
            entity.Property(comment => comment.Body).IsRequired().HasMaxLength(1000);
            entity.HasIndex(comment => new { comment.HallId, comment.CreatedAt });

            entity.HasOne(comment => comment.Hall)
                .WithMany(hall => hall.Comments)
                .HasForeignKey(comment => comment.HallId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(comment => comment.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Conversation>(entity =>
        {
            entity.ToTable("Conversations");

            entity.Property(conversation => conversation.InitiatorUserId).IsRequired().HasMaxLength(450);
            entity.Property(conversation => conversation.OwnerUserId).IsRequired().HasMaxLength(450);
            entity.HasIndex(conversation => new { conversation.HallId, conversation.InitiatorUserId }).IsUnique();

            entity.HasOne(conversation => conversation.Hall)
                .WithMany(hall => hall.Conversations)
                .HasForeignKey(conversation => conversation.HallId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(conversation => conversation.InitiatorUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
