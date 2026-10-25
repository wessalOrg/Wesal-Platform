using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConfirmedExternalBookings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Validate existing online data; never rewrite or discard it to satisfy the new constraints.
            migrationBuilder.AlterColumn<string>(
                name: "RequesterUserId",
                schema: "wesal",
                table: "Bookings",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450);

            migrationBuilder.AddColumn<long>(
                name: "Revision",
                schema: "wesal",
                table: "Bookings",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<int>(
                name: "Source",
                schema: "wesal",
                table: "Bookings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "BookingAuditEvents",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    Operation = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ActorUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    BeforeJson = table.Column<string>(type: "jsonb", nullable: true),
                    AfterJson = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookingAuditEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookingAuditEvents_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalSchema: "wesal",
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BookingMutationReceipts",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Operation = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Key = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    RequestHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ResponseJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookingMutationReceipts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExternalBookingDetails",
                schema: "wesal",
                columns: table => new
                {
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    EventType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Guests = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    AmountReceivedExternally = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    ConfirmedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancelledBy = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    CancellationReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExternalBookingDetails", x => x.BookingId);
                    table.CheckConstraint("CK_ExternalBookingDetails_Amounts", "(\"TotalAmount\" IS NULL OR \"TotalAmount\" >= 0) AND (\"AmountReceivedExternally\" IS NULL OR \"AmountReceivedExternally\" >= 0) AND (\"TotalAmount\" IS NULL OR \"AmountReceivedExternally\" IS NULL OR \"AmountReceivedExternally\" <= \"TotalAmount\")");
                    table.ForeignKey(
                        name: "FK_ExternalBookingDetails_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalSchema: "wesal",
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Bookings_Revision",
                schema: "wesal",
                table: "Bookings",
                sql: "\"Revision\" > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Bookings_Source",
                schema: "wesal",
                table: "Bookings",
                sql: "\"Source\" IN (0,1)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Bookings_SourceState",
                schema: "wesal",
                table: "Bookings",
                sql: "(\"Source\" = 0 AND \"RequesterUserId\" IS NOT NULL AND length(\"RequesterUserId\") > 0 AND \"Status\" IN (0,1,2,3)) OR (\"Source\" = 1 AND \"RequesterUserId\" IS NULL AND \"Status\" IN (3,4) AND \"DepositAmount\" IS NULL AND \"DepositPaymentConfirmedAt\" IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_BookingAuditEvents_BookingId_Revision",
                schema: "wesal",
                table: "BookingAuditEvents",
                columns: new[] { "BookingId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BookingMutationReceipts_HallId_ActorUserId_Operation_Key",
                schema: "wesal",
                table: "BookingMutationReceipts",
                columns: new[] { "HallId", "ActorUserId", "Operation", "Key" },
                unique: true);

            migrationBuilder.Sql("""
                CREATE FUNCTION wesal.reject_booking_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN RAISE EXCEPTION 'Booking audit history is append-only'; END $$;
                CREATE TRIGGER "BookingAuditAppendOnly" BEFORE UPDATE OR DELETE ON wesal."BookingAuditEvents"
                  FOR EACH ROW EXECUTE FUNCTION wesal.reject_booking_audit_mutation();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$ BEGIN
                  IF EXISTS (SELECT 1 FROM wesal."Bookings" WHERE "Source" = 1) THEN
                    RAISE EXCEPTION 'External bookings exist; rollback would destroy audit history.';
                  END IF;
                END $$;
                DROP TRIGGER IF EXISTS "BookingAuditAppendOnly" ON wesal."BookingAuditEvents";
                DROP FUNCTION IF EXISTS wesal.reject_booking_audit_mutation();
                """);
            migrationBuilder.DropTable(
                name: "BookingAuditEvents",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "BookingMutationReceipts",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "ExternalBookingDetails",
                schema: "wesal");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Bookings_Revision",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Bookings_Source",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Bookings_SourceState",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "Revision",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "Source",
                schema: "wesal",
                table: "Bookings");

            migrationBuilder.AlterColumn<string>(
                name: "RequesterUserId",
                schema: "wesal",
                table: "Bookings",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);
        }
    }
}
