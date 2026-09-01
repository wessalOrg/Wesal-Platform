using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageClientRequestId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClientRequestId",
                schema: "wesal",
                table: "Messages",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Messages_SenderUserId_ClientRequestId",
                schema: "wesal",
                table: "Messages",
                columns: new[] { "SenderUserId", "ClientRequestId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_SenderUserId_ClientRequestId",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ClientRequestId",
                schema: "wesal",
                table: "Messages");
        }
    }
}
