using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMabroukKnowledgeStudio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AiKnowledgeArticles",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    AnswerAr = table.Column<string>(type: "character varying(12000)", maxLength: 12000, nullable: false),
                    AnswerEn = table.Column<string>(type: "character varying(12000)", maxLength: 12000, nullable: true),
                    Source = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    PublicationStatus = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    VerificationStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: true),
                    EffectiveUntil = table.Column<DateOnly>(type: "date", nullable: true),
                    ReviewAt = table.Column<DateOnly>(type: "date", nullable: true),
                    PublishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    CurrentVersion = table.Column<int>(type: "integer", nullable: false),
                    PublishedVersion = table.Column<int>(type: "integer", nullable: true),
                    OverridesBuiltInKey = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    DraftSnapshotJson = table.Column<string>(type: "text", nullable: true),
                    NormalizedSearchText = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiKnowledgeArticles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AiKnowledgeAliases",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ArticleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NormalizedText = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiKnowledgeAliases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiKnowledgeAliases_AiKnowledgeArticles_ArticleId",
                        column: x => x.ArticleId,
                        principalSchema: "wesal",
                        principalTable: "AiKnowledgeArticles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AiKnowledgeGapClusters",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CanonicalQuestion = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    NormalizedKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    OccurrenceCount = table.Column<int>(type: "integer", nullable: false),
                    FirstSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SampleQuestionsJson = table.Column<string>(type: "text", nullable: false),
                    LinkedArticleId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IgnoredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    MergedIntoClusterId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiKnowledgeGapClusters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiKnowledgeGapClusters_AiKnowledgeArticles_LinkedArticleId",
                        column: x => x.LinkedArticleId,
                        principalSchema: "wesal",
                        principalTable: "AiKnowledgeArticles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AiKnowledgeGapClusters_AiKnowledgeGapClusters_MergedIntoClu~",
                        column: x => x.MergedIntoClusterId,
                        principalSchema: "wesal",
                        principalTable: "AiKnowledgeGapClusters",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AiKnowledgeRevisions",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ArticleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Action = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SnapshotJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    ChangeNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiKnowledgeRevisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiKnowledgeRevisions_AiKnowledgeArticles_ArticleId",
                        column: x => x.ArticleId,
                        principalSchema: "wesal",
                        principalTable: "AiKnowledgeArticles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeAliases_ArticleId_NormalizedText",
                schema: "wesal",
                table: "AiKnowledgeAliases",
                columns: new[] { "ArticleId", "NormalizedText" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeAliases_NormalizedText",
                schema: "wesal",
                table: "AiKnowledgeAliases",
                column: "NormalizedText");

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeArticles_Key",
                schema: "wesal",
                table: "AiKnowledgeArticles",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeArticles_OverridesBuiltInKey",
                schema: "wesal",
                table: "AiKnowledgeArticles",
                column: "OverridesBuiltInKey");

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeArticles_PublicationStatus_EffectiveFrom_Effecti~",
                schema: "wesal",
                table: "AiKnowledgeArticles",
                columns: new[] { "PublicationStatus", "EffectiveFrom", "EffectiveUntil" });

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeGapClusters_LinkedArticleId",
                schema: "wesal",
                table: "AiKnowledgeGapClusters",
                column: "LinkedArticleId");

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeGapClusters_MergedIntoClusterId",
                schema: "wesal",
                table: "AiKnowledgeGapClusters",
                column: "MergedIntoClusterId");

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeGapClusters_NormalizedKey",
                schema: "wesal",
                table: "AiKnowledgeGapClusters",
                column: "NormalizedKey",
                unique: true,
                filter: "\"Status\" IN ('New', 'Reviewed')");

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeGapClusters_Status_LastSeenAt",
                schema: "wesal",
                table: "AiKnowledgeGapClusters",
                columns: new[] { "Status", "LastSeenAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AiKnowledgeRevisions_ArticleId_Version",
                schema: "wesal",
                table: "AiKnowledgeRevisions",
                columns: new[] { "ArticleId", "Version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AiKnowledgeAliases",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "AiKnowledgeGapClusters",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "AiKnowledgeRevisions",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "AiKnowledgeArticles",
                schema: "wesal");
        }
    }
}
