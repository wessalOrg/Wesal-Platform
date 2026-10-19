using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCoordinatorAndPhotographerSetup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ApprovalStatus",
                schema: "wesal",
                table: "AspNetUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsSetupComplete",
                schema: "wesal",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "CoordinatorProfiles",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    BusinessType = table.Column<int>(type: "integer", nullable: false),
                    ShopName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ShopLocation = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ShopPhotoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OnlineStoreName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    WorkPhoto1Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    WorkPhoto2Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PhoneNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IdentityDocumentUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoordinatorProfiles", x => x.Id);
                    table.CheckConstraint("CK_CoordinatorProfiles_BusinessType", "\"BusinessType\" IN (1, 2)");
                });

            migrationBuilder.CreateTable(
                name: "UserNotifications",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ActionLabel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ActionTarget = table.Column<int>(type: "integer", nullable: false),
                    TargetId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ReadAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserNotifications", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoordinatorProfiles_UserId",
                schema: "wesal",
                table: "CoordinatorProfiles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_RecipientUserId_CreatedAt",
                schema: "wesal",
                table: "UserNotifications",
                columns: new[] { "RecipientUserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoordinatorProfiles",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "UserNotifications",
                schema: "wesal");

            migrationBuilder.DropColumn(
                name: "ApprovalStatus",
                schema: "wesal",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "IsSetupComplete",
                schema: "wesal",
                table: "AspNetUsers");
        }
    }
}
