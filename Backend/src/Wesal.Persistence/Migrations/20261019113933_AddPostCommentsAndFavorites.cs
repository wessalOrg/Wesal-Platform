using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wesal.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPostCommentsAndFavorites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SaveCount",
                schema: "wesal",
                table: "Posts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "PostComments",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    ParentCommentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReplyToCommentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostComments", x => x.Id);
                    table.CheckConstraint("CK_PostComments_TopLevelReply", "(\"ParentCommentId\" IS NULL AND \"ReplyToCommentId\" IS NULL) OR (\"ParentCommentId\" IS NOT NULL AND \"ReplyToCommentId\" IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_PostComments_AspNetUsers_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalSchema: "wesal",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostComments_PostComments_ParentCommentId",
                        column: x => x.ParentCommentId,
                        principalSchema: "wesal",
                        principalTable: "PostComments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostComments_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "wesal",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostFavorites",
                schema: "wesal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostFavorites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PostFavorites_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "wesal",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostFavorites_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "wesal",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Posts_SaveCount",
                schema: "wesal",
                table: "Posts",
                sql: "\"SaveCount\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_PostComments_AuthorUserId",
                schema: "wesal",
                table: "PostComments",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PostComments_ParentCommentId",
                schema: "wesal",
                table: "PostComments",
                column: "ParentCommentId");

            migrationBuilder.CreateIndex(
                name: "IX_PostComments_PostId_CreatedAt",
                schema: "wesal",
                table: "PostComments",
                columns: new[] { "PostId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PostFavorites_PostId",
                schema: "wesal",
                table: "PostFavorites",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_PostFavorites_UserId_CreatedAt",
                schema: "wesal",
                table: "PostFavorites",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PostFavorites_UserId_PostId",
                schema: "wesal",
                table: "PostFavorites",
                columns: new[] { "UserId", "PostId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PostComments",
                schema: "wesal");

            migrationBuilder.DropTable(
                name: "PostFavorites",
                schema: "wesal");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Posts_SaveCount",
                schema: "wesal",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "SaveCount",
                schema: "wesal",
                table: "Posts");
        }
    }
}
