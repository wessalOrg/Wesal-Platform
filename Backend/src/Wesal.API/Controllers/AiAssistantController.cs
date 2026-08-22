using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/ai/sessions")]
public class AiAssistantController : ControllerBase
{
    private readonly IChatSessionService _chatSessionService;

    public AiAssistantController(IChatSessionService chatSessionService)
    {
        _chatSessionService = chatSessionService;
    }

    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AiSessionResponse), StatusCodes.Status201Created)]
    public async Task<ActionResult<AiSessionResponse>> InitializeSession(
        [FromBody] InitializeAiSessionRequest? request,
        CancellationToken cancellationToken)
    {
        var response = await _chatSessionService.InitializeSessionAsync(
            request?.Language,
            cancellationToken);

        return CreatedAtAction(nameof(GetSession), new { sessionId = response.SessionId }, response);
    }

    [HttpGet("{sessionId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AiSessionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AiSessionResponse>> GetSession(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var response = await _chatSessionService.GetSessionAsync(sessionId, cancellationToken);

        if (response is null)
        {
            return NotFound();
        }

        return Ok(response);
    }
}
