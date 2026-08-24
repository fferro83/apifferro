using Microsoft.AspNetCore.Mvc;

namespace NewAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AssetsController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AssetsController> _logger;

        public AssetsController(IWebHostEnvironment env, ILogger<AssetsController> logger)
        {
            _env = env;
            _logger = logger;
        }

        // GET /api/assets/catalog
        // Reads Data/sample-data.csv and returns it as a JSON array of objects,
        // e.g. [{ "AssetId": "A001", "AssetType": "Pole", "Latitude": "37.9101", ... }, ...]
        [HttpGet("catalog")]
        public IActionResult GetCatalog()
        {
            var path = Path.Combine(_env.ContentRootPath, "Data", "sample-data.csv");

            if (!System.IO.File.Exists(path))
            {
                _logger.LogWarning("Asset catalog not found at {Path}", path);
                return NotFound(new { message = "sample-data.csv not found in Data folder." });
            }

            var lines = System.IO.File.ReadAllLines(path);
            if (lines.Length < 2)
            {
                return Ok(Array.Empty<Dictionary<string, string>>());
            }

            var headers = lines[0].Split(',').Select(h => h.Trim()).ToArray();

            var assets = lines.Skip(1)
                .Where(line => !string.IsNullOrWhiteSpace(line))
                .Select(line =>
                {
                    var values = line.Split(',').Select(v => v.Trim()).ToArray();
                    var row = new Dictionary<string, string>();
                    for (int i = 0; i < headers.Length && i < values.Length; i++)
                    {
                        row[headers[i]] = values[i];
                    }
                    return row;
                })
                .ToList();

            return Ok(assets);
        }
    }
}
