using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminUnlockAndWarningTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UnlockedAt",
                schema: "wesal",
                table: "Halls",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UnlockedByAdminUserId",
                schema: "wesal",
                table: "Halls",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WarningSentAttempts",
                schema: "wesal",
                table: "Halls",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateOnly>(
                name: "WarningSentForCycleEnd",
                schema: "wesal",
                table: "Halls",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UnlockedAt",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "UnlockedByAdminUserId",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "WarningSentAttempts",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "WarningSentForCycleEnd",
                schema: "wesal",
                table: "Halls");
        }
    }
}
