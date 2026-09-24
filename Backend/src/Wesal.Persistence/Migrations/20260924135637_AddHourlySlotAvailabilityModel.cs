using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHourlySlotAvailabilityModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "HourlySlotEnd",
                schema: "wesal",
                table: "Halls",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "HourlySlotStart",
                schema: "wesal",
                table: "Halls",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowBookedSlots",
                schema: "wesal",
                table: "Halls",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "NameOnBooking",
                schema: "wesal",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "SlotStart",
                schema: "wesal",
                table: "Bookings",
                type: "time without time zone",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));

            migrationBuilder.CreateTable(
                name: "HallDayAvailabilities",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    IsOpen = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HallDayAvailabilities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HallDayAvailabilities_Halls_HallId",
                        column: x => x.HallId,
                        principalSchema: "wesal",
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HallSlotAvailabilities",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HallSlotAvailabilities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HallSlotAvailabilities_Halls_HallId",
                        column: x => x.HallId,
                        principalSchema: "wesal",
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HallDayAvailabilities_HallId_Date",
                schema: "wesal",
                table: "HallDayAvailabilities",
                columns: new[] { "HallId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HallSlotAvailabilities_HallId_Date_StartTime",
                schema: "wesal",
                table: "HallSlotAvailabilities",
                columns: new[] { "HallId", "Date", "StartTime" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HallDayAvailabilities",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "HallSlotAvailabilities",
                schema: "wesal");

            migrationBuilder.DropColumn(
                name: "HourlySlotEnd",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "HourlySlotStart",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "ShowBookedSlots",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "NameOnBooking",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "SlotStart",
                schema: "wesal",
                table: "Bookings");
        }
    }
}
