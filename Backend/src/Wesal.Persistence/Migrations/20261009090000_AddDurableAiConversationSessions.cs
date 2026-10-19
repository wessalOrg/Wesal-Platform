using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Wesal.Persistence.Data;

#nullable disable

namespace Wesal.Persistence.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261009090000_AddDurableAiConversationSessions")]
public sealed class AddDurableAiConversationSessions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "AiConversationSessions",
            schema: "wesal",
            columns: table => new
            {
                SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                Language = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                LastActivityAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Revision = table.Column<int>(type: "integer", nullable: false),
                TurnsJson = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                LastIntentJson = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                LastHallsJson = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                LastHallJson = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_AiConversationSessions", x => x.SessionId));

        migrationBuilder.CreateIndex(
            name: "IX_AiConversationSessions_ExpiresAt",
            schema: "wesal",
            table: "AiConversationSessions",
            column: "ExpiresAt");

        migrationBuilder.CreateIndex(
            name: "IX_AiConversationSessions_UserId",
            schema: "wesal",
            table: "AiConversationSessions",
            column: "UserId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "AiConversationSessions", schema: "wesal");
    }
}
