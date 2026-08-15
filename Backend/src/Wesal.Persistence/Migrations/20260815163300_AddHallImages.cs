using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHallImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HallImages",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HallImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HallImages_Halls_HallId",
                        column: x => x.HallId,
                        principalSchema: "wesal",
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HallImages_HallId_DisplayOrder",
                schema: "wesal",
                table: "HallImages",
                columns: new[] { "HallId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_HallImages_HallId_IsDeleted",
                schema: "wesal",
                table: "HallImages",
                columns: new[] { "HallId", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HallImages",
                schema: "wesal");
        }
    }
}
