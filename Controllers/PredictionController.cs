using Microsoft.AspNetCore.Mvc;
using NewAPI.Models;
using NewAPI.Services;

namespace NewAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PredictionController : ControllerBase
    {
        private readonly PredictionService _service;

        public PredictionController(PredictionService service)
        {
            _service = service;
        }

        [HttpPost("train")]
        public IActionResult Train()
        {
            _service.TrainModel();
            return Ok("Model trained successfully.");
        }

        [HttpPost("predict")]
        public async Task<IActionResult> Predict([FromBody] UtilityAssetData input)
        {
            var result = await _service.PredictWithLiveWeatherAsync(input);
            return Ok(result);
        }
    }
}
