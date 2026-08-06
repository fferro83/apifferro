using Microsoft.ML;
using Microsoft.ML.Data;
using NewAPI.Models;

namespace NewAPI.Services
{
    public class PredictionService
    {
        private readonly MLContext _mlContext;
        private ITransformer _model;
        private readonly string _modelPath = Path.Combine(AppContext.BaseDirectory, "Models", "TrainedModel.zip");
        private readonly string _dataPath = Path.Combine(AppContext.BaseDirectory, "Data", "sample-data.csv");


        public PredictionService()
        {
            _mlContext = new MLContext(seed: 0);
        }

        public void TrainModel()
        {
            // 1. Load data
            IDataView dataView = _mlContext.Data.LoadFromTextFile<UtilityAssetData>(
                _dataPath, hasHeader: true, separatorChar: ',');

            // 2. Split into train/test (80/20)
            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.1);

            // 3. Build pipeline (binary classification — matches bool NeedsMaintenance)
            var pipeline = _mlContext.Transforms.Categorical.OneHotEncoding("AssetTypeEncoded", "AssetType")
                .Append(_mlContext.Transforms.Concatenate("Features",
                    "AssetTypeEncoded", "Latitude", "Longitude", "AgeYears", "LastInspectionMonthsAgo"))
                .Append(_mlContext.BinaryClassification.Trainers.SdcaLogisticRegression(
                    labelColumnName: "NeedsMaintenance", featureColumnName: "Features"));

            // Note: for pure binary Yes/No, use BinaryClassification trainer instead:
            // var pipeline = _mlContext.Transforms.Categorical.OneHotEncoding("AssetTypeEncoded", "AssetType")
            //     .Append(_mlContext.Transforms.Concatenate("Features",
            //         "AssetTypeEncoded", "Latitude", "Longitude", "AgeYears", "LastInspectionMonthsAgo"))
            //     .Append(_mlContext.BinaryClassification.Trainers.SdcaLogisticRegression(
            //         labelColumnName: "NeedsMaintenance", featureColumnName: "Features"));

            // 4. Train
            _model = pipeline.Fit(split.TrainSet);

            try
            {
                var predictions = _model.Transform(split.TestSet);
                var metrics = _mlContext.BinaryClassification.Evaluate(predictions, labelColumnName: "NeedsMaintenance");
                Console.WriteLine($"Accuracy: {metrics.Accuracy:P2}");
                Console.WriteLine($"AUC: {metrics.AreaUnderRocCurve:P2}");
                Console.WriteLine($"F1 Score: {metrics.F1Score:P2}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Evaluation skipped (likely too little data for a balanced test split): {ex.Message}");
            }

            _mlContext.Model.Save(_model, dataView.Schema, _modelPath);
        }

        public MaintenancePrediction Predict(UtilityAssetData input)
        {
            if (_model == null)
            {
                if (File.Exists(_modelPath))
                    _model = _mlContext.Model.Load(_modelPath, out _);
                else
                    throw new InvalidOperationException("Model not trained yet. Call TrainModel() first.");
            }

            var predictionEngine = _mlContext.Model.CreatePredictionEngine<UtilityAssetData, MaintenancePrediction>(_model);
            return predictionEngine.Predict(input);
        }
    }
}
