using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations;

public partial class AddEventRequestCard : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "PayloadJson", schema: "wesal", table: "UserNotifications", type: "jsonb", nullable: true);
        migrationBuilder.AddColumn<Guid>(name: "EventRequestId", schema: "wesal", table: "Conversations", type: "uuid", nullable: true);
        migrationBuilder.AddColumn<int>(name: "ServiceType", schema: "wesal", table: "Conversations", type: "integer", nullable: true);

        migrationBuilder.CreateTable(name: "EventRequests", schema: "wesal", columns: table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false),
            SeekerId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
            SeekerFullName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
            EventDate = table.Column<DateOnly>(type: "date", nullable: false),
            EventType = table.Column<int>(type: "integer", nullable: false),
            NeedsHall = table.Column<bool>(type: "boolean", nullable: false),
            NeedsDecorationAndGifts = table.Column<bool>(type: "boolean", nullable: false),
            NeedsPhotographers = table.Column<bool>(type: "boolean", nullable: false),
            FanoutCompleted = table.Column<bool>(type: "boolean", nullable: false),
            FanoutAttempts = table.Column<int>(type: "integer", nullable: false),
            FanoutNextAttemptAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
            CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            CreatedBy = table.Column<string>(type: "text", nullable: true),
            UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
            UpdatedBy = table.Column<string>(type: "text", nullable: true)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_EventRequests", x => x.Id);
            table.ForeignKey(name: "FK_EventRequests_AspNetUsers_SeekerId", column: x => x.SeekerId, principalSchema: "wesal", principalTable: "AspNetUsers", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
        });

        migrationBuilder.CreateTable(name: "EventRequestNotificationTargets", schema: "wesal", columns: table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false),
            EventRequestId = table.Column<Guid>(type: "uuid", nullable: false),
            ProviderId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
            ServiceType = table.Column<int>(type: "integer", nullable: false),
            NotificationId = table.Column<Guid>(type: "uuid", nullable: false),
            ConversationId = table.Column<Guid>(type: "uuid", nullable: false),
            CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_EventRequestNotificationTargets", x => x.Id);
            table.ForeignKey(name: "FK_EventRequestNotificationTargets_AspNetUsers_ProviderId", column: x => x.ProviderId, principalSchema: "wesal", principalTable: "AspNetUsers", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            table.ForeignKey(name: "FK_EventRequestNotificationTargets_EventRequests_EventRequestId", column: x => x.EventRequestId, principalSchema: "wesal", principalTable: "EventRequests", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            table.ForeignKey(name: "FK_EventRequestNotificationTargets_UserNotifications_NotificationId", column: x => x.NotificationId, principalSchema: "wesal", principalTable: "UserNotifications", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
        });

        migrationBuilder.CreateIndex(name: "IX_Conversations_EventRequestId", schema: "wesal", table: "Conversations", column: "EventRequestId");
        migrationBuilder.CreateIndex(name: "IX_EventRequests_SeekerId_CreatedAt", schema: "wesal", table: "EventRequests", columns: new[] { "SeekerId", "CreatedAt" });
        migrationBuilder.CreateIndex(name: "IX_EventRequests_EventDate", schema: "wesal", table: "EventRequests", column: "EventDate");
        migrationBuilder.CreateIndex(name: "IX_EventRequestNotificationTargets_EventRequestId_ProviderId_ServiceType", schema: "wesal", table: "EventRequestNotificationTargets", columns: new[] { "EventRequestId", "ProviderId", "ServiceType" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_EventRequestNotificationTargets_NotificationId", schema: "wesal", table: "EventRequestNotificationTargets", column: "NotificationId", unique: true);
        migrationBuilder.CreateIndex(name: "IX_EventRequestNotificationTargets_ProviderId", schema: "wesal", table: "EventRequestNotificationTargets", column: "ProviderId");
        migrationBuilder.CreateIndex(name: "IX_EventRequestNotificationTargets_ConversationId", schema: "wesal", table: "EventRequestNotificationTargets", column: "ConversationId");
        migrationBuilder.AddForeignKey(name: "FK_Conversations_EventRequests_EventRequestId", schema: "wesal", table: "Conversations", column: "EventRequestId", principalSchema: "wesal", principalTable: "EventRequests", principalColumn: "Id", onDelete: ReferentialAction.SetNull);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: "FK_Conversations_EventRequests_EventRequestId", schema: "wesal", table: "Conversations");
        migrationBuilder.DropTable(name: "EventRequestNotificationTargets", schema: "wesal");
        migrationBuilder.DropTable(name: "EventRequests", schema: "wesal");
        migrationBuilder.DropIndex(name: "IX_Conversations_EventRequestId", schema: "wesal", table: "Conversations");
        migrationBuilder.DropColumn(name: "PayloadJson", schema: "wesal", table: "UserNotifications");
        migrationBuilder.DropColumn(name: "EventRequestId", schema: "wesal", table: "Conversations");
        migrationBuilder.DropColumn(name: "ServiceType", schema: "wesal", table: "Conversations");
    }
}
