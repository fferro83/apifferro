using Microsoft.ML.Data;
namespace NewAPI.Models
{
    // Input schema — matches your CSV columns
    public class UtilityAssetData
    {
        [LoadColumn(0)] public string AssetId { get; set; }
        [LoadColumn(1)] public string AssetType { get; set; }      // e.g. "Pole", "Transformer", "Meter"
        [LoadColumn(2)] public float Latitude { get; set; }
        [LoadColumn(3)] public float Longitude { get; set; }
        [LoadColumn(4)] public float AgeYears { get; set; }
        [LoadColumn(5)] public float LastInspectionMonthsAgo { get; set; }
        [LoadColumn(6)] public bool NeedsMaintenance { get; set; }  // Label to predict
    }

    // Prediction output
    public class MaintenancePrediction
    {
        [ColumnName("PredictedLabel")]
        public bool NeedsMaintenance { get; set; }

        public float Probability { get; set; }
        public float Score { get; set; }
    }

    public class ImageData
    {
        public string ImagePath { get; set; }
        public string Label { get; set; }
    }

    public class ImagePrediction
    {
        [ColumnName("PredictedLabel")]
        public string PredictedLabel { get; set; }

        public float[] Score { get; set; }
    }
}
