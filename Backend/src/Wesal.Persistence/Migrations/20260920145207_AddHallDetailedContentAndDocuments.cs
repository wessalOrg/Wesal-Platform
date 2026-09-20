using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHallDetailedContentAndDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DetailedAddress",
                schema: "wesal",
                table: "Halls",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OtherFeatures",
                schema: "wesal",
                table: "Halls",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PaymentReceiptUploadedAt",
                schema: "wesal",
                table: "Halls",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentReceiptUrl",
                schema: "wesal",
                table: "Halls",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "YouTubeVideoUrl",
                schema: "wesal",
                table: "Halls",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IdentityDocumentUploadedAt",
                schema: "wesal",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentUrl",
                schema: "wesal",
                table: "AspNetUsers",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "HallFeatures",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HallFeatures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HallFeatures_Halls_HallId",
                        column: x => x.HallId,
                        principalSchema: "wesal",
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HallFeatures_HallId_Name",
                schema: "wesal",
                table: "HallFeatures",
                columns: new[] { "HallId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HallFeatures",
                schema: "wesal");

            migrationBuilder.DropColumn(
                name: "DetailedAddress",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "OtherFeatures",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "PaymentReceiptUploadedAt",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "PaymentReceiptUrl",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "YouTubeVideoUrl",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentUploadedAt",
                schema: "wesal",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentUrl",
                schema: "wesal",
                table: "AspNetUsers");
        }
    }
}
