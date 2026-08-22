using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AISessionStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AISessions",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    IsGuestSession = table.Column<bool>(type: "boolean", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastAccessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AiServiceStatus = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    GuestIdentifier = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AISessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AISessions_IsGuestSession_GuestIdentifier",
                schema: "wesal",
                table: "AISessions",
                columns: new[] { "IsGuestSession", "GuestIdentifier" });

            migrationBuilder.CreateIndex(
                name: "IX_AISessions_SessionId",
                schema: "wesal",
                table: "AISessions",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AISessions_UserId_IsGuestSession",
                schema: "wesal",
                table: "AISessions",
                columns: new[] { "UserId", "IsGuestSession" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AISessions_SessionId",
                schema: "wesal",
                table: "AISessions");

            migrationBuilder.DropIndex(
                name: "IX_AISessions_UserId_IsGuestSession",
                schema: "wesal",
                table: "AISessions");

            migrationBuilder.DropIndex(
                name: "IX_AISessions_IsGuestSession_GuestIdentifier",
                schema: "wesal",
                table: "AISessions");

            migrationBuilder.DropTable(
                name: "AISessions",
                schema: "wesal");
        }
    }
}