using System.Runtime.CompilerServices;

// The test project asserts that repository query expressions translate to real SQL, not just
// to in-memory LINQ. That needs access to the internal expression builders, which stay
// internal so they are not part of the production surface.
[assembly: InternalsVisibleTo("Wesal.Tests")]
