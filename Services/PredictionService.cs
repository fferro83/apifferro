using Microsoft.ML;
using NewAPI.Models;

namespace NewAPI.Services
{
    public class PredictionService
    {
        private readonly MLContext _mlContext;
        private readonly WeatherService _weatherService;
        private ITransformer _model;
        private readonly string _modelPath = "Models/TrainedModel.zip";
        private readonly string _dataPath = "Data/sample-data.csv";

        public PredictionService(WeatherService weatherService)
        {
            _mlContext = new MLContext(seed: 0);
            _weatherService = weatherService;

            if (File.Exists(_modelPath))
            {
                _model = _mlContext.Model.Load(_modelPath, out _);
            }
        }

        public void TrainModel()
        {
            IDataView dataView = _mlContext.Data.LoadFromTextFile<UtilityAssetData>(
                _dataPath, hasHeader: true, separatorChar: ',');

            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

            var pipeline = _mlContext.Transforms.Categorical.OneHotEncoding("AssetTypeEncoded", "AssetType")
            .Append(_mlContext.Transforms.Concatenate("Features",
                "AssetTypeEncoded", "Latitude", "Longitude", "AgeYears", "LastInspectionMonthsAgo",
                "TemperatureC", "WindSpeedKph", "PrecipitationMm", "FireWeatherIndex"))
                .Append(_mlContext.BinaryClassification.Trainers.SdcaLogisticRegression(
                    labelColumnName: "NeedsMaintenance", featureColumnName: "Features"));

            _model = pipeline.Fit(split.TrainSet);

            try
            {
                var predictions = _model.Transform(split.TestSet);
                var metrics = _mlContext.BinaryClassification.Evaluate(predictions, labelColumnName: "NeedsMaintenance");
                Console.WriteLine($"Accuracy: {metrics.Accuracy:P2}, AUC: {metrics.AreaUnderRocCurve:P2}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Evaluation skipped: {ex.Message}");
            }

            _mlContext.Model.Save(_model, dataView.Schema, _modelPath);
        }
        public async Task<PredictionWithWeather> PredictWithLiveWeatherAsync(UtilityAssetData input)
        {
            var (temp, wind, precip) = await _weatherService.GetCurrentWeatherAsync(input.Latitude, input.Longitude);
            var (fwi, dangerRating) = _weatherService.CalculateFireRisk(temp, wind, precip);

            input.TemperatureC = temp;
            input.WindSpeedKph = wind;
            input.PrecipitationMm = precip;
            input.FireWeatherIndex = fwi;

            var prediction = Predict(input);
            var (priorityScore, priorityLevel) = CalculatePriority(prediction.Probability, fwi, input.AgeYears);

            return new PredictionWithWeather
            {
                NeedsMaintenance = prediction.NeedsMaintenance,
                Probability = prediction.Probability,
                Score = prediction.Score,
                TemperatureC = temp,
                WindSpeedKph = wind,
                PrecipitationMm = precip,
                FireWeatherIndex = fwi,
                FireDangerRating = dangerRating,
                PriorityScore = priorityScore,       // ✅ ADD THIS
                PriorityLevel = priorityLevel         // ✅ ADD THIS
            };
        }

        public MaintenancePrediction Predict(UtilityAssetData input)
        {
            if (_model == null)
                throw new InvalidOperationException("Model not trained yet. Call TrainModel() first.");

            var predictionEngine = _mlContext.Model.CreatePredictionEngine<UtilityAssetData, MaintenancePrediction>(_model);
            return predictionEngine.Predict(input);
        }

        private (float Score, string Level) CalculatePriority(float maintenanceProbability, float fireWeatherIndex, float ageYears)
        {
            float maintenanceFactor = maintenanceProbability * 100f;
            float fireFactor = Math.Min(fireWeatherIndex, 100f);
            float ageFactor = Math.Min(ageYears / 30f * 100f, 100f);

            float score = (maintenanceFactor * 0.5f) + (fireFactor * 0.3f) + (ageFactor * 0.2f);
            score = Math.Max(0, Math.Min(100, score));

            string level = score switch
            {
                >= 75 => "Critical",
                >= 50 => "High",
                >= 25 => "Medium",
                _ => "Low"
            };

            return (score, level);
        }
    }
}