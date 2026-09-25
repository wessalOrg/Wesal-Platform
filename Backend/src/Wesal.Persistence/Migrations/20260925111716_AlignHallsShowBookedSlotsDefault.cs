using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AlignHallsShowBookedSlotsDefault : Migration
    {
        /// <summary>
        /// WESAL-TASK-1 hardening: align the Halls.ShowBookedSlots column default with the
        /// entity default (true), which was created as defaultValue:false by
        /// 20260924135637_AddHourlySlotAvailabilityModel.
        ///
        /// Schema-default only, by design. This issues
        /// <c>ALTER TABLE wesal."Halls" ALTER COLUMN "ShowBookedSlots" SET DEFAULT TRUE</c>,
        /// a catalog-only change that affects future INSERTs only. It contains no UPDATE
        /// statement, so every existing production row keeps its current stored value.
        /// </summary>
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "ShowBookedSlots",
                schema: "wesal",
                table: "Halls",
                type: "boolean",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "boolean");
        }

        /// <summary>
        /// Restores the exact prior schema state (column default false), again without
        /// rewriting any existing row.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "ShowBookedSlots",
                schema: "wesal",
                table: "Halls",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: true);
        }
    }
}
