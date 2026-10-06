namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Shared provider-resolution rule for the private protected-document stores
/// (identity documents and message attachments). Both reuse the same switch:
/// <c>DocumentStorage:Provider</c> (<c>Local</c>/<c>Supabase</c>) with Supabase chosen
/// automatically when usable credentials are present, and an unknown name failing
/// startup loudly so a misconfigured deployment can never silently fall back to
/// ephemeral disk.
/// </summary>
internal static class ProtectedDocumentStoreProvider
{
    internal const string ProviderLocal = "Local";
    internal const string ProviderSupabase = "Supabase";

    internal static string Resolve(string? configuredProvider, bool supabaseConfigured)
    {
        if (string.IsNullOrWhiteSpace(configuredProvider))
        {
            return supabaseConfigured ? ProviderSupabase : ProviderLocal;
        }

        if (string.Equals(configuredProvider, ProviderLocal, StringComparison.OrdinalIgnoreCase)
            || string.Equals(configuredProvider, ProviderSupabase, StringComparison.OrdinalIgnoreCase))
        {
            return configuredProvider;
        }

        throw new InvalidOperationException(
            $"Unknown DocumentStorage:Provider '{configuredProvider}'. Expected '{ProviderLocal}' or '{ProviderSupabase}'.");
    }
}