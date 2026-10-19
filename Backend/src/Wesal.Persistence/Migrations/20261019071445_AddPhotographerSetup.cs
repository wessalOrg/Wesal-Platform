using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotographerSetup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PhotographerProfiles",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    HasStudio = table.Column<bool>(type: "boolean", nullable: false),
                    StudioName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    StudioLocation = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DetailedStudioLocation = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    PhoneNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IdentityDocumentUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotographerProfiles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhotographerProfiles_UserId",
                schema: "wesal",
                table: "PhotographerProfiles",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhotographerProfiles",
                schema: "wesal");
        }
    }
}
