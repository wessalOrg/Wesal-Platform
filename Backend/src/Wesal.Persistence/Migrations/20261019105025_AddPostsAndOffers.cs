using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPostsAndOffers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HallOffers",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<Guid>(type: "uuid", nullable: false),
                    OldBookingPrice = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    OfferPrice = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    StoppedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExpiredProcessedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HallOffers", x => x.Id);
                    table.CheckConstraint("CK_HallOffers_Prices", "\"OldBookingPrice\" > 0 AND \"OfferPrice\" > 0 AND \"OfferPrice\" < \"OldBookingPrice\"");
                    table.CheckConstraint("CK_HallOffers_Window", "\"EndsAt\" > \"StartsAt\"");
                    table.ForeignKey(
                        name: "FK_HallOffers_Halls_HallId",
                        column: x => x.HallId,
                        principalSchema: "wesal",
                        principalTable: "Halls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Posts",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Price = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Posts", x => x.Id);
                    table.CheckConstraint("CK_Posts_Price", "\"Price\" IS NULL OR \"Price\" >= 0");
                    table.ForeignKey(
                        name: "FK_Posts_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalSchema: "wesal",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProfessionalOffers",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    OldPrice = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    OfferPrice = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    PriceBox = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    StoppedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReminderSentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExpiredProcessedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReminderEligible = table.Column<bool>(type: "boolean", nullable: false),
                    HasBeenEdited = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfessionalOffers", x => x.Id);
                    table.CheckConstraint("CK_ProfessionalOffers_Prices", "\"OldPrice\" > 0 AND \"OfferPrice\" > 0 AND \"OfferPrice\" < \"OldPrice\" AND (\"PriceBox\" IS NULL OR \"PriceBox\" >= 0)");
                    table.CheckConstraint("CK_ProfessionalOffers_Window", "\"EndsAt\" > \"StartsAt\"");
                    table.ForeignKey(
                        name: "FK_ProfessionalOffers_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalSchema: "wesal",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostImages",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PostImages_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "wesal",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProfessionalOfferImages",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OfferId = table.Column<Guid>(type: "uuid", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfessionalOfferImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProfessionalOfferImages_ProfessionalOffers_OfferId",
                        column: x => x.OfferId,
                        principalSchema: "wesal",
                        principalTable: "ProfessionalOffers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HallOffers_HallId_StartsAt_EndsAt",
                schema: "wesal",
                table: "HallOffers",
                columns: new[] { "HallId", "StartsAt", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PostImages_PostId_Order",
                schema: "wesal",
                table: "PostImages",
                columns: new[] { "PostId", "Order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Posts_OwnerUserId_CreatedAt",
                schema: "wesal",
                table: "Posts",
                columns: new[] { "OwnerUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ProfessionalOfferImages_OfferId_Order",
                schema: "wesal",
                table: "ProfessionalOfferImages",
                columns: new[] { "OfferId", "Order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfessionalOffers_EndsAt_ReminderSentAt_ExpiredProcessedAt",
                schema: "wesal",
                table: "ProfessionalOffers",
                columns: new[] { "EndsAt", "ReminderSentAt", "ExpiredProcessedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ProfessionalOffers_OwnerUserId_CreatedAt",
                schema: "wesal",
                table: "ProfessionalOffers",
                columns: new[] { "OwnerUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ProfessionalOffers_StoppedAt_StartsAt_EndsAt",
                schema: "wesal",
                table: "ProfessionalOffers",
                columns: new[] { "StoppedAt", "StartsAt", "EndsAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HallOffers",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "PostImages",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "ProfessionalOfferImages",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "Posts",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "ProfessionalOffers",
                schema: "wesal");
        }
    }
}
