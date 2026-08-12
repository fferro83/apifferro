namespace NewAPI.Models
{
    public class PredictionWithWeather
    {
        public bool NeedsMaintenance { get; set; }
        public float Probability { get; set; }
        public float Score { get; set; }
        public float TemperatureC { get; set; }
        public float WindSpeedKph { get; set; }
        public float PrecipitationMm { get; set; }
        public float FireWeatherIndex { get; set; }
        public string FireDangerRating { get; set; }
        public float PriorityScore { get; set; }      // ✅ ADD THIS
        public string PriorityLevel { get; set; }      // ✅ ADD THIS
    }
}