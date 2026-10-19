using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPendingMessageSourceContext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PendingContextOfferId",
                schema: "wesal",
                table: "Conversations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PendingContextPostId",
                schema: "wesal",
                table: "Conversations",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PendingContextOfferId",
                schema: "wesal",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "PendingContextPostId",
                schema: "wesal",
                table: "Conversations");
        }
    }
}
