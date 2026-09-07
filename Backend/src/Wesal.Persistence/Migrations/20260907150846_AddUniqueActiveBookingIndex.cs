using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueActiveBookingIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                schema: "wesal",
                table: "Messages",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationId_SenderUserId_IdempotencyKey",
                schema: "wesal",
                table: "Messages",
                columns: new[] { "ConversationId", "SenderUserId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_HallId_Date_Period",
                schema: "wesal",
                table: "Bookings",
                columns: new[] { "HallId", "Date", "Period" },
                unique: true,
                filter: "\"Status\" IN (0, 2)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationId_SenderUserId_IdempotencyKey",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_HallId_Date_Period",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                schema: "wesal",
                table: "Messages");
        }
    }
}
