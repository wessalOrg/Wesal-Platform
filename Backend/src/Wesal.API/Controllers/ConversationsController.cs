using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/conversations")]
public class ConversationsController : ControllerBase
{
    private readonly IConversationService _conversationService;

    public ConversationsController(IConversationService conversationService)
    {
        _conversationService = conversationService;
    }

    [HttpPost]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ConversationResponse>> CreateConversation(
        [FromBody] CreateConversationRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _conversationService.CreateConversationAsync(request, cancellationToken);
        if (response.IsExisting)
        {
            return Ok(response);
        }

        return CreatedAtAction(nameof(GetConversation), new { conversationId = response.ConversationId }, response);
    }

    [HttpGet("{conversationId:guid}")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ConversationResponse>> GetConversation(
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        var response = await _conversationService.GetConversationAsync(conversationId, cancellationToken);
        return Ok(response);
    }
}
