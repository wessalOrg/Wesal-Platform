using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationsAndPublishingRestrictions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserPublishingRestrictions",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedByAdminId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LiftedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPublishingRestrictions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPublishingRestrictions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "wesal",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserPublishingRestrictions_EndsAt",
                schema: "wesal",
                table: "UserPublishingRestrictions",
                column: "EndsAt",
                filter: "\"LiftedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserPublishingRestrictions_UserId",
                schema: "wesal",
                table: "UserPublishingRestrictions",
                column: "UserId",
                unique: true,
                filter: "\"LiftedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserPublishingRestrictions_UserId_EndsAt",
                schema: "wesal",
                table: "UserPublishingRestrictions",
                columns: new[] { "UserId", "EndsAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserPublishingRestrictions",
                schema: "wesal");
        }
    }
}
