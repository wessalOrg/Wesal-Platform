using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddContentViewEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ContentViewEvents",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProfileUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    ViewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentViewEvents", x => x.Id);
                    table.CheckConstraint("CK_ContentViewEvents_OneTarget", "(\"PostId\" IS NOT NULL AND \"ProfileUserId\" IS NULL) OR (\"PostId\" IS NULL AND \"ProfileUserId\" IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_ContentViewEvents_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalSchema: "wesal",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ContentViewEvents_AspNetUsers_ProfileUserId",
                        column: x => x.ProfileUserId,
                        principalSchema: "wesal",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ContentViewEvents_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "wesal",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContentViewEvents_OwnerUserId_ViewedAt",
                schema: "wesal",
                table: "ContentViewEvents",
                columns: new[] { "OwnerUserId", "ViewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ContentViewEvents_PostId",
                schema: "wesal",
                table: "ContentViewEvents",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentViewEvents_ProfileUserId",
                schema: "wesal",
                table: "ContentViewEvents",
                column: "ProfileUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContentViewEvents",
                schema: "wesal");
        }
    }
}
