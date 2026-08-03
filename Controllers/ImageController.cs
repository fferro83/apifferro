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

        [HttpPost("predict")]
        public async Task<IActionResult> Predict(IFormFile file, [FromForm] string? expectedAssetType)
        {
            var tempPath = Path.Combine(Path.GetTempPath(), file.FileName);
            using (var stream = new FileStream(tempPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var allDetections = await _service.PredictAsync(tempPath);
            System.IO.File.Delete(tempPath);

            // If an expected type was provided, filter to just that class
            var filtered = allDetections;
            if (!string.IsNullOrEmpty(expectedAssetType))
            {
                filtered = allDetections
                    .Where(d => d.Class.Equals(expectedAssetType, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            return Ok(new
            {
                DetectionCount = filtered.Count,
                TopLabel = filtered.Count > 0 ? filtered[0].Class : "No matching objects detected",
                TopConfidence = filtered.Count > 0 ? filtered[0].Confidence : 0f,
                Detections = filtered.Select(d => new
                {
                    d.Class,
                    d.Confidence,
                    d.X,
                    d.Y,
                    d.Width,
                    d.Height
                }),
                AllDetectionsUnfiltered = allDetections.Select(d => new { d.Class, d.Confidence }) // for debugging/comparison
            });
        }

    }
}
