using System.Text;
using System.Text.Json;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;

namespace NewAPI.Services
{
    public class DetectionResult
    {
        public string Class { get; set; } = "";
        public float Confidence { get; set; }
        public float X { get; set; }
        public float Y { get; set; }
        public float Width { get; set; }
        public float Height { get; set; }
    }

    public class ImageClassificationService
    {
        private readonly HttpClient _httpClient;
        private const string ApiKey = "JGOLVU96CURgxRSbVZhi"; // move to config/env variable
        private const string WorkflowUrl = "https://serverless.roboflow.com/franciscos-workspace-zvqjw/workflows/my-first-project-vmy-first-project-7ostk-4-yolo26n-t1-logic-2";

        public ImageClassificationService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<List<DetectionResult>> PredictAsync(string imagePath)
        {
            var base64Image = await ResizeAndEncodeAsync(imagePath);

            var payload = new
            {
                api_key = ApiKey,
                inputs = new
                {
                    image = new { type = "base64", value = base64Image }
                }
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(WorkflowUrl, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"Roboflow error ({response.StatusCode}): {responseBody}");
            }

            return ParsePredictions(responseBody);
        }

        private List<DetectionResult> ParsePredictions(string responseBody)
        {
            using var doc = JsonDocument.Parse(responseBody);
            var results = new List<DetectionResult>();

            // Navigate to the predictions array — structure is nested under outputs
            var root = doc.RootElement;

            // Roboflow workflow responses are typically an array of outputs;
            // find the "predictions" array wherever it lives in this shape
            JsonElement predictionsElement = default;
            bool found = FindPredictionsArray(root, out predictionsElement);

            if (!found)
                return results;

            foreach (var pred in predictionsElement.EnumerateArray())
            {
                results.Add(new DetectionResult
                {
                    Class = pred.GetProperty("class").GetString() ?? "Unknown",
                    Confidence = pred.GetProperty("confidence").GetSingle(),
                    X = pred.GetProperty("x").GetSingle(),
                    Y = pred.GetProperty("y").GetSingle(),
                    Width = pred.GetProperty("width").GetSingle(),
                    Height = pred.GetProperty("height").GetSingle()
                });
            }

            // Sort by confidence, highest first
            return results.OrderByDescending(r => r.Confidence).ToList();
        }

        private bool FindPredictionsArray(JsonElement element, out JsonElement result)
        {
            if (element.ValueKind == JsonValueKind.Object)
            {
                if (element.TryGetProperty("predictions", out var predictions) && predictions.ValueKind == JsonValueKind.Array)
                {
                    result = predictions;
                    return true;
                }
                foreach (var prop in element.EnumerateObject())
                {
                    if (FindPredictionsArray(prop.Value, out result))
                        return true;
                }
            }
            else if (element.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in element.EnumerateArray())
                {
                    if (FindPredictionsArray(item, out result))
                        return true;
                }
            }

            result = default;
            return false;
        }

        private async Task<string> ResizeAndEncodeAsync(string imagePath)
        {
            using var image = await SixLabors.ImageSharp.Image.LoadAsync(imagePath);

            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Mode = ResizeMode.Max,
                Size = new SixLabors.ImageSharp.Size(1024, 1024)
            }));

            using var ms = new MemoryStream();
            await image.SaveAsync(ms, new JpegEncoder { Quality = 80 });

            return Convert.ToBase64String(ms.ToArray());
        }
    }
}