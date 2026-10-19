using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/notifications")]
[Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
public sealed class NotificationsController(INotificationInboxService notifications) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<UserNotificationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<UserNotificationDto>>> GetMine([FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, [FromQuery] bool unreadOnly = false, CancellationToken cancellationToken = default)
        => Ok(await notifications.GetMineAsync(page, pageSize, unreadOnly, cancellationToken));

    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<ActionResult<int>> GetUnreadCount(CancellationToken cancellationToken)
        => Ok(await notifications.GetUnreadCountAsync(cancellationToken));

    [HttpPut("{notificationId:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkRead(Guid notificationId, CancellationToken cancellationToken)
        => await notifications.MarkReadAsync(notificationId, cancellationToken) ? NoContent() : NotFound();

    [HttpPut("read-all")]
    [ProducesResponseType(typeof(MarkNotificationsReadResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<MarkNotificationsReadResponse>> MarkAllRead(CancellationToken cancellationToken)
        => Ok(new MarkNotificationsReadResponse { UpdatedCount = await notifications.MarkAllReadAsync(cancellationToken) });
}
