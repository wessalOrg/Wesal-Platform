using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConversationMessageAttachments_RemovePaymentReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentReceiptUploadedAt",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.DropColumn(
                name: "PaymentReceiptUrl",
                schema: "wesal",
                table: "Halls");

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                schema: "wesal",
                table: "Messages",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentContentType",
                schema: "wesal",
                table: "Messages",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentFileName",
                schema: "wesal",
                table: "Messages",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentUrl",
                schema: "wesal",
                table: "Messages",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttachmentContentType",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "AttachmentFileName",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "AttachmentUrl",
                schema: "wesal",
                table: "Messages");

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                schema: "wesal",
                table: "Messages",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

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
        }
    }
}
