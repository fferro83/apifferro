using Microsoft.AspNetCore.Mvc;
using NewAPI.Services;

namespace NewAPI.Controllers

{
    [ApiController]
    [Route("api/[controller]")]
    public class ImageController : ControllerBase
    {
        private readonly ImageClassificationService _service;

        public ImageController(ImageClassificationService service)
        {
            _service = service;
        }

        [HttpPost("train")]
        public IActionResult Train()
        {
            _service.TrainModel();
            return Ok("Image model trained successfully.");
        }

        [HttpPost("predict")]
        public async Task<IActionResult> Predict(IFormFile file)
        {
            var tempPath = Path.Combine(Path.GetTempPath(), file.FileName);
            using (var stream = new FileStream(tempPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var result = _service.PredictFromFile(tempPath);
            System.IO.File.Delete(tempPath);

            return Ok(new
            {
                Label = result.PredictedLabel,
                Confidence = result.Score.Max()
            });
        }
    }
}
