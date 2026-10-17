using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Wesal.Persistence.Data;

#nullable disable

namespace Wesal.Persistence.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261009150000_AddAiConversationState")]
public sealed class AddAiConversationState : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
        => migrationBuilder.AddColumn<string>(
            name: "ConversationStateJson",
            schema: "wesal",
            table: "AiConversationSessions",
            type: "character varying(8000)",
            maxLength: 8000,
            nullable: true);

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropColumn(
            name: "ConversationStateJson",
            schema: "wesal",
            table: "AiConversationSessions");
}
