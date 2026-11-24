using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AdsPlatform.Services;

namespace AdsPlatform.Controllers;

[ApiController]
[Authorize]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly ICampaignReportService _reports;

    public ReportsController(ICampaignReportService reports)
    {
        _reports = reports;
    }

    [HttpGet("campaigns/{campaignId:long}/daily")]
    public async Task<ActionResult<CampaignDailyReport>> Daily(
        long campaignId,
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > 92)
        {
            return BadRequest("Range must be 1 to 92 days.");
        }

        var report = await _reports.GetDailyAsync(campaignId, from, to, ct);
        return report is null ? NotFound() : Ok(report);
    }
}
