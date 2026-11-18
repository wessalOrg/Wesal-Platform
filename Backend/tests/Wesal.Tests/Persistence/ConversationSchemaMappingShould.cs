using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Wesal.Persistence.Migrations;

namespace Wesal.Tests.Persistence;

public class ConversationSchemaMappingShould
{
    [Fact]
    public void QueryTheServiceColumnCreatedByTheMigration()
    {
        // Compile the real PostgreSQL model without opening a database connection.
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=unused_schema_test;Username=unused")
            .Options);
        var migration = new AddEventRequestCard();
        var column = Assert.Single(migration.UpOperations.OfType<AddColumnOperation>(),
            operation => operation.Table == "Conversations" && operation.Name == "ServiceType");
        var table = StoreObjectIdentifier.Table("Conversations", "wesal");
        var property = db.Model.FindEntityType(typeof(Conversation))!
            .FindProperty(nameof(Conversation.EventRequestServiceType))!;

        Assert.Equal(column.Name, property.GetColumnName(table));
        var sql = db.Conversations.Select(row => row.EventRequestServiceType).ToQueryString();
        Assert.Contains("c.\"ServiceType\"", sql);
        Assert.DoesNotContain("c.\"EventRequestServiceType\"", sql);
    }

    [Fact]
    public void KeepMigrationMetadataConsistentWithItsPhysicalColumn()
    {
        var table = StoreObjectIdentifier.Table("Conversations", "wesal");
        var migrationModel = new AddEventRequestCard().TargetModel;
        var snapshotModel = new ApplicationDbContextModelSnapshot().Model;

        foreach (var model in new[] { migrationModel, snapshotModel })
        {
            var property = model.FindEntityType(typeof(Conversation).FullName!)!
                .FindProperty(nameof(Conversation.EventRequestServiceType))!;
            Assert.Equal("ServiceType", property.GetColumnName(table));
        }
    }
}
