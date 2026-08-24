using System.Text.Json;

namespace NewAPI.Services
{
    public class WeatherService
    {
        private readonly HttpClient _httpClient;
        private const string ApiKey = "3423690574d7fd4fd9d9ed992c5e5699"; // your real key here

        public WeatherService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<(float TemperatureC, float WindSpeedKph, float PrecipitationMm)> GetCurrentWeatherAsync(float lat, float lon)
        {
            var url = $"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={ApiKey}&units=imperial";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            float temp = root.GetProperty("main").GetProperty("temp").GetSingle();
            float windSpeedMs = root.GetProperty("wind").GetProperty("speed").GetSingle();
            float windSpeedKph = windSpeedMs * 3.6f;

            float precipitation = 0f;
            if (root.TryGetProperty("rain", out var rain) && rain.TryGetProperty("1h", out var rain1h))
            {
                precipitation = rain1h.GetSingle();
            }

            return (temp, windSpeedKph, precipitation);
        }

        public async Task<(float FireWeatherIndex, string DangerRating)> GetFireRiskAsync(float lat, float lon)
        {
            var url = $"https://api.openweathermap.org/data/2.5/fwi?lat={lat}&lon={lon}&appid={ApiKey}";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var listItem = root.GetProperty("list")[0];
            float fwi = listItem.GetProperty("main").GetProperty("fwi").GetSingle();
            string dangerRating = listItem.GetProperty("danger_rating").GetProperty("description").GetString() ?? "Unknown";

            return (fwi, dangerRating);
        }

        public (float RiskScore, string RiskLevel) CalculateFireRisk(float tempC, float windKph, float precipMm)
        {
            float score = (tempC * 1.5f) + (windKph * 0.8f) - (precipMm * 3f);
            score = Math.Max(0, Math.Min(100, score));

            string level = score switch
            {
                >= 70 => "Extreme",
                >= 50 => "High",
                >= 30 => "Moderate",
                _ => "Low"
            };

            return (score, level);
        }
    }
}