using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingDepositAndPaymentConfirmation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ApprovalMessageId",
                schema: "wesal",
                table: "Bookings",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DepositAmount",
                schema: "wesal",
                table: "Bookings",
                type: "numeric(12,2)",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DepositPaymentConfirmedAt",
                schema: "wesal",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_ApprovalMessageId",
                schema: "wesal",
                table: "Bookings",
                column: "ApprovalMessageId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_ApprovalMessageId",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ApprovalMessageId",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "DepositAmount",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "DepositPaymentConfirmedAt",
                schema: "wesal",
                table: "Bookings");
        }
    }
}
