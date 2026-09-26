using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
public class ConversationsController : ControllerBase
{
    private readonly IConversationService _conversationService;

    public ConversationsController(IConversationService conversationService)
    {
        _conversationService = conversationService;
    }

    [HttpPost("api/v{version:apiVersion}/halls/{hallId:guid}/conversations")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ConversationResponse>> CreateConversation(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var response = await _conversationService.CreateConversationAsync(hallId, cancellationToken);
        return CreatedAtAction(nameof(GetConversation), new { version = "1", conversationId = response.ConversationId }, response);
    }

    [HttpGet("api/v{version:apiVersion}/conversations/{conversationId:guid}")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ConversationResponse>> GetConversation(
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        var response = await _conversationService.GetConversationAsync(conversationId, cancellationToken);
        return Ok(response);
    }

    [HttpGet("api/v{version:apiVersion}/conversations")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(IReadOnlyList<ConversationSummaryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<IReadOnlyList<ConversationSummaryResponse>>> GetMyConversations(
        CancellationToken cancellationToken)
    {
        var response = await _conversationService.GetMyConversationsAsync(cancellationToken);
        return Ok(response);
    }

    [HttpGet("api/v{version:apiVersion}/conversations/{conversationId:guid}/messages")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(MessageThreadResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MessageThreadResponse>> GetConversationMessages(
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        var response = await _conversationService.GetConversationThreadAsync(conversationId, cancellationToken);
        return Ok(response);
    }

    [HttpPost("api/v{version:apiVersion}/conversations/{conversationId:guid}/messages")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(SendMessageResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SendMessageResponse>> SendMessage(
        Guid conversationId,
        SendMessageRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _conversationService.SendMessageAsync(conversationId, request, cancellationToken);
        return CreatedAtAction(
            nameof(GetConversationMessages),
            new { version = "1", conversationId },
            response);
    }

    /// <summary>
    /// Posts a message that carries an image attachment (WESAL-TASK-4, Edit 4). This is
    /// how a hall owner sends subscription-payment proof to the Admins inside the same
    /// owner/Admin thread used for every other message.
    ///
    /// Deliberately a NEW endpoint rather than a multipart overload of the existing
    /// JSON message endpoint: the text-only contract stays byte-identical for existing
    /// clients. The optional <c>content</c> field is the caption and may be omitted, so
    /// the owner can send the proof image on its own. Accepts jpg/jpeg/png/webp up to 5MB
    /// and rejects anything whose bytes do not match the declared image type.
    /// </summary>
    [HttpPost("api/v{version:apiVersion}/conversations/{conversationId:guid}/messages/attachment")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(SendMessageResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SendMessageResponse>> SendAttachmentMessage(
        Guid conversationId,
        IFormFile file,
        [FromForm] string? content,
        [FromForm] string? clientRequestId,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            ModelState.AddModelError(nameof(file), "An image file is required.");
            return ValidationProblem(ModelState);
        }

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, cancellationToken);

        var upload = new MessageAttachmentUpload
        {
            FileName = file.FileName,
            ContentType = file.ContentType,
            Content = ms.ToArray()
        };

        var response = await _conversationService.SendAttachmentMessageAsync(
            conversationId, upload, content, clientRequestId, cancellationToken);

        return CreatedAtAction(
            nameof(GetConversationMessages),
            new { version = "1", conversationId },
            response);
    }

    /// <summary>
    /// Streams a message's image attachment to an authenticated participant of the
    /// conversation (WESAL-TASK-4, Edit 4). Attachments are stored outside the public
    /// static-file area, so this protected endpoint is the only way to read one.
    /// </summary>
    [HttpGet("api/v{version:apiVersion}/conversations/{conversationId:guid}/messages/{messageId:guid}/attachment")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMessageAttachment(
        Guid conversationId,
        Guid messageId,
        CancellationToken cancellationToken)
    {
        var document = await _conversationService.GetMessageAttachmentAsync(
            conversationId, messageId, cancellationToken);

        return PhysicalFile(document.FullPath, document.ContentType, document.FileName);
    }

    [HttpPost("api/v{version:apiVersion}/conversations/{conversationId:guid}/read")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        await _conversationService.MarkAsReadAsync(conversationId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Removes one conversation from the caller's OWN inbox (WESAL-TASK-6, Edit 6).
    ///
    /// Despite the verb, nothing is deleted. This is a per-user visibility toggle: the
    /// conversation, all of its messages, and every other participant's view are left
    /// exactly as they were. Other participants keep the thread in their inbox and can
    /// still read the full history.
    ///
    /// The thread reappears in the caller's inbox automatically once a new message arrives
    /// after this call, because a hide is recorded as a timestamp rather than a permanent
    /// flag. The thread itself stays reachable by id, so a deep link still works — only
    /// inbox membership changes. Idempotent; re-hiding simply hides it again.
    /// </summary>
    [HttpDelete("api/v{version:apiVersion}/conversations/{conversationId:guid}")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> HideConversation(
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        await _conversationService.HideConversationAsync(conversationId, cancellationToken);
        return NoContent();
    }

    [HttpGet("api/v{version:apiVersion}/conversations/unread-count")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(UnreadCountResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UnreadCountResponse>> GetUnreadCount(
        CancellationToken cancellationToken)
    {
        var response = await _conversationService.GetUnreadCountAsync(cancellationToken);
        return Ok(response);
    }
}
