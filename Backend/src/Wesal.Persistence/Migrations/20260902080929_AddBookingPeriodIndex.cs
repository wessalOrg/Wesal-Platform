using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingPeriodIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Bookings_HallId_Date_Period_Status",
                schema: "wesal",
                table: "Bookings",
                columns: new[] { "HallId", "Date", "Period", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_HallId_Date_Period_Status",
                schema: "wesal",
                table: "Bookings");
        }
    }
}
