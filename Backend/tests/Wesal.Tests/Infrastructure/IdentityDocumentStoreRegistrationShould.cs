using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.Documents;

namespace Wesal.Tests.Infrastructure;

public class IdentityDocumentStoreRegistrationShould
{
    private static IConfiguration Config(params (string Key, string Value)[] values)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value))
            .Build();

    [Fact]
    public void EmptyConfig_DefaultsToLocal()
    {
        var info = IdentityDocumentStoreRegistration.DescribeIdentityDocumentStorage(Config());

        Assert.False(info.IsRemote);
        Assert.Equal(IdentityDocumentStoreRegistration.ProviderLocal, info.Provider);
        Assert.Null(info.Bucket);
    }

    [Fact]
    public void SupabaseCredentials_AreAutoSelectedWithoutAnExplicitProvider()
    {
        var configuration = Config(
            ("SupabaseStorage:Url", "https://x.supabase.co"),
            ("SupabaseStorage:SecretKey", "svc-key"));

        var info = IdentityDocumentStoreRegistration.DescribeIdentityDocumentStorage(configuration);

        Assert.True(info.IsRemote);
        Assert.Equal(IdentityDocumentStoreRegistration.ProviderSupabase, info.Provider);
        Assert.Equal("identity-documents", info.Bucket);
    }

    [Fact]
    public void ExplicitLocal_WinsEvenWhenSupabaseIsAlsoConfigured()
    {
        var configuration = Config(
            ("DocumentStorage:Provider", "Local"),
            ("SupabaseStorage:Url", "https://x.supabase.co"),
            ("SupabaseStorage:SecretKey", "svc-key"));

        var info = IdentityDocumentStoreRegistration.DescribeIdentityDocumentStorage(configuration);

        Assert.False(info.IsRemote);
        Assert.Equal(IdentityDocumentStoreRegistration.ProviderLocal, info.Provider);
    }

    [Fact]
    public void Registration_Supabase_BindsThePrivateBucketStore()
    {
        var configuration = Config(
            ("DocumentStorage:Provider", "Supabase"),
            ("SupabaseStorage:Url", "https://x.supabase.co"),
            ("SupabaseStorage:SecretKey", "svc-key"),
            ("SupabaseStorage:IdentityDocumentsBucket", "identity-documents"));

        var provider = new ServiceCollection().AddIdentityDocumentStore(configuration).BuildServiceProvider();

        var store = provider.GetRequiredService<IIdentityDocumentStore>();
        Assert.IsType<SupabaseIdentityDocumentStore>(store);
    }

    [Fact]
    public void Registration_AutoSelection_IsSupabaseWhenConfigured()
    {
        var configuration = Config(
            ("SupabaseStorage:Url", "https://x.supabase.co"),
            ("SupabaseStorage:SecretKey", "svc-key"));

        var provider = new ServiceCollection().AddIdentityDocumentStore(configuration).BuildServiceProvider();

        Assert.IsType<SupabaseIdentityDocumentStore>(provider.GetRequiredService<IIdentityDocumentStore>());
    }

    [Fact]
    public void Registration_NamedSupabaseWithoutCredentials_FailsFast()
    {
        var configuration = Config(("DocumentStorage:Provider", "Supabase"));

        var ex = Assert.Throws<InvalidOperationException>(() =>
            new ServiceCollection().AddIdentityDocumentStore(configuration));

        Assert.Contains("SupabaseStorage:Url", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Registration_UnknownProvider_FailsFastInsteadOfSilentlyFallingBack()
    {
        var configuration = Config(("DocumentStorage:Provider", "R2"));

        Assert.Throws<InvalidOperationException>(() =>
            new ServiceCollection().AddIdentityDocumentStore(configuration));
    }
}