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
    private readonly IHowToService _howToService;
    private readonly IRecommendationService _recommendationService;

    public AiAssistantController(
        IChatSessionService chatSessionService,
        IHowToService howToService,
        IRecommendationService recommendationService)
    {
        _chatSessionService = chatSessionService;
        _howToService = howToService;
        _recommendationService = recommendationService;
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

    [HttpPost("{sessionId:guid}/how-to")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HowToResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HowToResponse>> AskHowTo(
        Guid sessionId,
        [FromBody] HowToRequest request,
        CancellationToken cancellationToken)
    {
        var session = await _chatSessionService.GetSessionAsync(sessionId, cancellationToken);

        if (session is null)
        {
            return NotFound();
        }

        var response = await _howToService.AskHowToAsync(
            request.Question!,
            session.Language,
            cancellationToken);

        return Ok(response);
    }

    [HttpPost("{sessionId:guid}/recommend")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(RecommendationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(RecommendationResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<RecommendationResponse>> GetRecommendations(
        Guid sessionId,
        [FromBody] RecommendationRequest request,
        CancellationToken cancellationToken)
    {
        var session = await _chatSessionService.GetSessionAsync(sessionId, cancellationToken);

        if (session is null)
        {
            return NotFound();
        }

        RecommendationResponse response;
        try
        {
            response = await _recommendationService.GetRecommendationsAsync(
                request.Message!,
                session.Language,
                cancellationToken);
        }
        catch (Exception)
        {
            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new RecommendationResponse(
                    RecommendationStatus.AiUnavailable,
                    null,
                    Array.Empty<HallRecommendationDto>(),
                    "The recommendation service is temporarily unavailable. Please try again later.",
                    DateTime.UtcNow));
        }

        return Ok(response);
    }
}
