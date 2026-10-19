using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AccountLockAdminMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LiftedByAdminId",
                schema: "wesal",
                table: "UserPublishingRestrictions",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserPublishingRestrictions_UserId_StartsAt_EndsAt",
                schema: "wesal",
                table: "UserPublishingRestrictions",
                columns: new[] { "UserId", "StartsAt", "EndsAt" },
                filter: "\"LiftedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserPublishingRestrictions_UserId_StartsAt_EndsAt",
                schema: "wesal",
                table: "UserPublishingRestrictions");

            migrationBuilder.DropColumn(
                name: "LiftedByAdminId",
                schema: "wesal",
                table: "UserPublishingRestrictions");
        }
    }
}
