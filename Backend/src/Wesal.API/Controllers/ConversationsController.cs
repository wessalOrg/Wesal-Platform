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
}
