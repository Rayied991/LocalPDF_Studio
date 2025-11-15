using LocalPDF_Studio_api.BLL.Interfaces;
using LocalPDF_Studio_api.BLL.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace LocalPDF_Studio_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GhostscriptController : ControllerBase
    {
        private readonly IGhostscriptInterface _ghostscriptInterface;

        public GhostscriptController(IGhostscriptInterface ghostscriptInterface)
        {
            _ghostscriptInterface = ghostscriptInterface;
        }

        [HttpGet("check")]
        public async Task<IActionResult> CheckGhostscript()
        {
            try
            {
                var isAvailable = await _ghostscriptInterface.IsGhostscriptAvailableAsync();
                var version = isAvailable ? await _ghostscriptInterface.GetGhostscriptVersionAsync() : null;

                return Ok(new
                {
                    available = isAvailable,
                    version = version
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    available = false,
                    error = ex.Message
                });
            }
        }
    }
}
