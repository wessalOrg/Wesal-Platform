using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageNotificationDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ConversationId",
                schema: "wesal",
                table: "UserNotifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GroupSenderUserId",
                schema: "wesal",
                table: "UserNotifications",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MessageCount",
                schema: "wesal",
                table: "UserNotifications",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "MessagePreview",
                schema: "wesal",
                table: "UserNotifications",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SenderAvatarUrl",
                schema: "wesal",
                table: "UserNotifications",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SenderName",
                schema: "wesal",
                table: "UserNotifications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_RecipientUserId_ConversationId_GroupSende~",
                schema: "wesal",
                table: "UserNotifications",
                columns: new[] { "RecipientUserId", "ConversationId", "GroupSenderUserId", "ReadAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserNotifications_RecipientUserId_ConversationId_GroupSende~",
                schema: "wesal",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "ConversationId",
                schema: "wesal",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "GroupSenderUserId",
                schema: "wesal",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "MessageCount",
                schema: "wesal",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "MessagePreview",
                schema: "wesal",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "SenderAvatarUrl",
                schema: "wesal",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "SenderName",
                schema: "wesal",
                table: "UserNotifications");
        }
    }
}
