using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHallPaymentAndLockExecutionState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LockedAt",
                schema: "wesal",
                table: "Halls",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LockedByAdminUserId",
                schema: "wesal",
                table: "Halls",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentStatus",
                schema: "wesal",
                table: "Halls",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateOnly>(
                name: "SubscriptionCycleStart",
                schema: "wesal",
                table: "Halls",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SystemLocked",
                schema: "wesal",
                table: "Halls",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Halls_Status_PaymentStatus_SystemLocked_SubscriptionCycleEnd",
                schema: "wesal",
                table: "Halls",
                columns: new[] { "Status", "PaymentStatus", "SystemLocked", "SubscriptionCycleEnd" });

            // Existing live halls predate payment tracking; model them as paid so the
            // strict payment gate (US-ADMIN-07) does not lock out hall owners
            // retroactively. New subscription payments will manage this flag going forward.
            migrationBuilder.Sql(
                "UPDATE \"wesal\".\"Halls\" SET \"PaymentStatus\" = 1 WHERE \"Status\" = 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Halls_Status_PaymentStatus_SystemLocked_SubscriptionCycleEnd",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "LockedAt",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "LockedByAdminUserId",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "PaymentStatus",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "SubscriptionCycleStart",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "SystemLocked",
                schema: "wesal",
                table: "Halls");
        }
    }
}
