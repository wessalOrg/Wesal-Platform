using Wesal.Application.Common.Models;

namespace Wesal.Tests.Application;

public class PagedResultShould
{
    [Fact]
    public void ComputeTotalPages()
    {
        var items = new List<string> { "a", "b", "c", "d", "e" };
        var result = PagedResult<string>.Create(items, pageNumber: 1, pageSize: 2, totalCount: 5);

        Assert.Equal(3, result.TotalPages);
        Assert.True(result.HasNextPage);
        Assert.False(result.HasPreviousPage);
    }

    [Fact]
    public void HandleEmptyPageSize()
    {
        var result = PagedResult<string>.Create([], pageNumber: 1, pageSize: 0, totalCount: 0);

        Assert.Equal(0, result.TotalPages);
    }

    [Fact]
    public void ReportLastPage()
    {
        var result = PagedResult<string>.Create(["x"], pageNumber: 3, pageSize: 1, totalCount: 3);

        Assert.Equal(3, result.TotalPages);
        Assert.False(result.HasNextPage);
        Assert.True(result.HasPreviousPage);
    }
}
