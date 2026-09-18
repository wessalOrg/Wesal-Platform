using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHallSubscriptionState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAdminLocked",
                schema: "wesal",
                table: "Halls",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "SubscriptionCycleEnd",
                schema: "wesal",
                table: "Halls",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAdminLocked",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "SubscriptionCycleEnd",
                schema: "wesal",
                table: "Halls");
        }
    }
}
