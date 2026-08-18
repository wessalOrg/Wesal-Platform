using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommentsDataValidation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Comments_HallId",
                schema: "wesal",
                table: "Comments");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_HallId_CreatedAt",
                schema: "wesal",
                table: "Comments",
                columns: new[] { "HallId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Comments_UserId",
                schema: "wesal",
                table: "Comments",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Comments_AspNetUsers_UserId",
                schema: "wesal",
                table: "Comments",
                column: "UserId",
                principalSchema: "wesal",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Comments_AspNetUsers_UserId",
                schema: "wesal",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Comments_HallId_CreatedAt",
                schema: "wesal",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Comments_UserId",
                schema: "wesal",
                table: "Comments");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_HallId",
                schema: "wesal",
                table: "Comments",
                column: "HallId");
        }
    }
}
