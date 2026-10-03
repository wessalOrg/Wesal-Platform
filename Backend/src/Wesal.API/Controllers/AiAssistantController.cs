using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Ai;
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
    private readonly IAiAssistantService _aiAssistantService;
    private readonly ICurrentUserService _currentUser;

    public AiAssistantController(
        IChatSessionService chatSessionService,
        IHowToService howToService,
        IRecommendationService recommendationService,
        IAiAssistantService aiAssistantService,
        ICurrentUserService currentUser)
    {
        _chatSessionService = chatSessionService;
        _howToService = howToService;
        _recommendationService = recommendationService;
        _aiAssistantService = aiAssistantService;
        _currentUser = currentUser;
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
            cancellationToken,
            CurrentUserId);

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
        var response = await _chatSessionService.GetSessionAsync(sessionId, cancellationToken, CurrentUserId);

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
        var session = await _chatSessionService.GetSessionAsync(sessionId, cancellationToken, CurrentUserId);

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
        var session = await _chatSessionService.GetSessionAsync(sessionId, cancellationToken, CurrentUserId);

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
                    session.Language,
                    DateTime.UtcNow));
        }

        return Ok(response);
    }

    /// <summary>
    /// Unified assistant turn. The body may carry an untrusted page context (pathname)
    /// and a pinned entity (a hall id); the backend validates both, re-resolves the hall
    /// from live services, and answers from exactly one trusted source (live tools,
    /// Knowledge Base, deterministic policy, navigation registry or a clarification).
    /// The returned <see cref="AiAssistantResponse"/> carries a stable kind discriminator
    /// plus optional trusted navigation actions. The legacy /how-to and /recommend
    /// endpoints remain untouched.
    /// </summary>
    [HttpPost("{sessionId:guid}/assistant")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AiAssistantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AiAssistantResponse>> AskAssistant(
        Guid sessionId,
        [FromBody] AiAssistantRequest request,
        CancellationToken cancellationToken)
    {
        var session = await _chatSessionService.GetSessionAsync(sessionId, cancellationToken, CurrentUserId);

        if (session is null)
        {
            return NotFound();
        }

        var message = request?.Message?.Trim();
        if (string.IsNullOrWhiteSpace(message))
        {
            return BadRequest(new { Message = "Message is required." });
        }

        var context = await _chatSessionService.GetConversationContextAsync(sessionId, cancellationToken, CurrentUserId);

        AiAssistantResponse response;
        try
        {
            response = await _aiAssistantService.ProcessMessageAsync(
                message,
                session.Language,
                cancellationToken,
                context,
                new AiRequestContext(request?.Page, request?.Entity));
        }
        catch (ArgumentException)
        {
            return BadRequest(new { Message = "Message is invalid." });
        }

        await _chatSessionService.SaveExchangeAsync(
            sessionId,
            message,
            response.Message,
            response.Intent,
            AiResponseMemory.ShownHalls(response),
            AiResponseMemory.FocusedHall(response),
            cancellationToken);

        return Ok(response);
    }

    private string? CurrentUserId => _currentUser.IsAuthenticated ? _currentUser.UserId : null;
}
