using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLegacyPeriodBookingModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HallAvailabilities",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "HallBookingPeriods",
                schema: "wesal");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_HallId_Date_Period_Status",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "Period",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "SlotStart",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.CreateTable(
                name: "BookingSlots",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookingSlots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookingSlots_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalSchema: "wesal",
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_HallId_Date_Status",
                schema: "wesal",
                table: "Bookings",
                columns: new[] { "HallId", "Date", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_BookingSlots_BookingId_StartTime",
                schema: "wesal",
                table: "BookingSlots",
                columns: new[] { "BookingId", "StartTime" },
                unique: true);

            // The remaining legacy bookings are the old fake/test data: every one of them
            // belongs to the removed two-period model and owns no hourly slot, so nothing
            // in the hourly lifecycle can ever resolve, release, or display it. They are
            // cleared here instead of being carried forward as dead rows. The NOT EXISTS
            // guard keeps any already-migrated booking that does own slots.
            migrationBuilder.Sql(
                """
                DELETE FROM "wesal"."Bookings"
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM "wesal"."BookingSlots" AS "slot"
                    WHERE "slot"."BookingId" = "Bookings"."Id"
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restores the two-period schema, but the legacy bookings deleted in Up are
            // intentionally not brought back: they were fake/test data, and the restored
            // Period column has no way to hold their original values.
            migrationBuilder.DropTable(
                name: "BookingSlots",
                schema: "wesal");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_HallId_Date_Status",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.AddColumn<int>(
                name: "Period",
                schema: "wesal",
                table: "Bookings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "SlotStart",
                schema: "wesal",
                table: "Bookings",
                type: "time without time zone",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));

            migrationBuilder.CreateTable(
                name: "HallAvailabilities",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    PeriodType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HallAvailabilities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HallAvailabilities_Halls_HallId",
                        column: x => x.HallId,
                        principalSchema: "wesal",
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HallBookingPeriods",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HallBookingPeriods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HallBookingPeriods_Halls_HallId",
                        column: x => x.HallId,
                        principalSchema: "wesal",
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_HallId_Date_Period_Status",
                schema: "wesal",
                table: "Bookings",
                columns: new[] { "HallId", "Date", "Period", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_HallAvailabilities_HallId_Date_PeriodType",
                schema: "wesal",
                table: "HallAvailabilities",
                columns: new[] { "HallId", "Date", "PeriodType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HallBookingPeriods_HallId_Type",
                schema: "wesal",
                table: "HallBookingPeriods",
                columns: new[] { "HallId", "Type" },
                unique: true);
        }
    }
}
