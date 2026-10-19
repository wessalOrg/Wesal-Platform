using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPostSharingAndProfessionalMessaging : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ShareCount",
                schema: "wesal",
                table: "Posts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ContextImageUrl",
                schema: "wesal",
                table: "Messages",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ContextOfferId",
                schema: "wesal",
                table: "Messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContextOwnerUserId",
                schema: "wesal",
                table: "Messages",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ContextPostId",
                schema: "wesal",
                table: "Messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContextText",
                schema: "wesal",
                table: "Messages",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContextTitle",
                schema: "wesal",
                table: "Messages",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                schema: "wesal",
                table: "Conversations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("UPDATE wesal.\"Conversations\" SET \"Kind\" = 1 WHERE \"HallId\" IS NULL");

            migrationBuilder.CreateTable(
                name: "PostShares",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    UtcDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostShares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PostShares_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "wesal",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Posts_ShareCount",
                schema: "wesal",
                table: "Posts",
                sql: "\"ShareCount\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Messages_OneContext",
                schema: "wesal",
                table: "Messages",
                sql: "\"ContextPostId\" IS NULL OR \"ContextOfferId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_SenderUserId_HallOwnerId",
                schema: "wesal",
                table: "Conversations",
                columns: new[] { "SenderUserId", "HallOwnerId" },
                unique: true,
                filter: "\"Kind\" = 2");

            migrationBuilder.CreateIndex(
                name: "IX_PostShares_PostId",
                schema: "wesal",
                table: "PostShares",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_PostShares_UserId_PostId_UtcDate",
                schema: "wesal",
                table: "PostShares",
                columns: new[] { "UserId", "PostId", "UtcDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PostShares",
                schema: "wesal");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Posts_ShareCount",
                schema: "wesal",
                table: "Posts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Messages_OneContext",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Conversations_SenderUserId_HallOwnerId",
                schema: "wesal",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "ShareCount",
                schema: "wesal",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "ContextImageUrl",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ContextOfferId",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ContextOwnerUserId",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ContextPostId",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ContextText",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ContextTitle",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "Kind",
                schema: "wesal",
                table: "Conversations");
        }
    }
}
