using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// How conversation message attachments are stored.
/// </summary>
public sealed record MessageAttachmentStorageInfo(bool IsDurable, string Provider, string? Bucket);

/// <summary>
/// Provider selection for the durable message-attachment store. Shares the identity-document
/// rule: <c>DocumentStorage:Provider</c> (<c>Local</c> default in Development,
/// <c>Supabase</c> for a Supabase Storage private bucket), and registers exactly one
/// <see cref="Application.Common.Interfaces.IMessageAttachmentStore"/>.
///
/// When no provider is named, Supabase is chosen automatically if <c>SupabaseStorage</c>
/// credentials are present, so a configured deployment is durable without extra knobs.
/// Naming <c>Supabase</c> without usable credentials, or naming an unknown provider,
/// fails startup loudly rather than silently writing to an ephemeral disk.
/// </summary>
public static class MessageAttachmentStoreRegistration
{
    public static IServiceCollection AddMessageAttachmentStore(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<SupabaseStorageOptions>()
            .Bind(configuration.GetSection(SupabaseStorageOptions.SectionName));

        var configuredProvider = configuration.GetSection(DocumentStorageOptions.SectionName)
            .Get<DocumentStorageOptions>()?.Provider;

        var supabase = configuration.GetSection(SupabaseStorageOptions.SectionName)
            .Get<SupabaseStorageOptions>() ?? new SupabaseStorageOptions();

        var provider = ProtectedDocumentStoreProvider.Resolve(configuredProvider, supabase.IsConfigured);

        if (string.Equals(provider, ProtectedDocumentStoreProvider.ProviderSupabase, StringComparison.OrdinalIgnoreCase))
        {
            if (!supabase.IsConfigured)
            {
                throw new InvalidOperationException(
                    $"DocumentStorage:Provider is '{ProtectedDocumentStoreProvider.ProviderSupabase}' but SupabaseStorage:Url / SupabaseStorage:SecretKey are missing or empty.");
            }

            services.AddHttpClient(SupabaseMessageAttachmentStore.HttpClientName, (sp, client) =>
            {
                var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<SupabaseStorageOptions>>().Value;
                client.BaseAddress = new Uri(options.Url!.TrimEnd('/') + "/storage/v1/");
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds > 0 ? options.TimeoutSeconds : 30);
            });

            services.AddSingleton<Application.Common.Interfaces.IMessageAttachmentStore, SupabaseMessageAttachmentStore>();
            return services;
        }

        services.AddSingleton<Application.Common.Interfaces.IMessageAttachmentStore>(LocalMessageAttachmentStore.Instance);
        return services;
    }

    /// <summary>Active provider for startup diagnostics (names settings, never secrets).</summary>
    public static MessageAttachmentStorageInfo DescribeMessageAttachmentStorage(IConfiguration configuration)
    {
        var configuredProvider = configuration.GetSection(DocumentStorageOptions.SectionName)
            .Get<DocumentStorageOptions>()?.Provider;

        var supabase = configuration.GetSection(SupabaseStorageOptions.SectionName)
            .Get<SupabaseStorageOptions>() ?? new SupabaseStorageOptions();

        var provider = ProtectedDocumentStoreProvider.Resolve(configuredProvider, supabase.IsConfigured);
        var durable = string.Equals(provider, ProtectedDocumentStoreProvider.ProviderSupabase, StringComparison.OrdinalIgnoreCase);

        return new MessageAttachmentStorageInfo(
            durable,
            provider,
            durable ? supabase.ConversationAttachmentsBucket : null);
    }
}