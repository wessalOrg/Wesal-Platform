namespace Wesal.Tests.Ai;

internal static class RepoPaths
{
    /// <summary>Walks up from the test binary until the repository root (has Backend/ and Frontend/).</summary>
    public static string Root()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "Backend")) && Directory.Exists(Path.Combine(dir.FullName, "Frontend")))
            {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Repository root not found from " + AppContext.BaseDirectory);
    }
}
