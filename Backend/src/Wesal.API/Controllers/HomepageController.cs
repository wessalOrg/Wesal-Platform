using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/homepage")]
public class HomepageController : ControllerBase
{
    private readonly IHomepageIntroductionService _homepageIntroductionService;

    public HomepageController(IHomepageIntroductionService homepageIntroductionService)
    {
        _homepageIntroductionService = homepageIntroductionService;
    }

    [HttpGet("introduction")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HomepageIntroductionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<HomepageIntroductionDto>> GetIntroduction(CancellationToken cancellationToken)
    {
        var introduction = await _homepageIntroductionService.GetIntroductionAsync(cancellationToken);

        return Ok(introduction);
    }
}
