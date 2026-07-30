
using Microsoft.ML;
using Microsoft.ML.Data;
using NewAPI.Models;

namespace NewAPI.Services
{
    public class ImageClassificationService
    {
        private readonly MLContext _mlContext;
        private ITransformer _model;
        private readonly string _modelPath = "Models/ImageModel.zip";
        private readonly string _imagesFolder = "Data/Images";

        public ImageClassificationService()
        {
            _mlContext = new MLContext(seed: 0);
        }

        private IEnumerable<ImageData> LoadImagesFromFolder(string folder)
        {
            foreach (var dir in Directory.GetDirectories(folder))
            {
                var label = Path.GetFileName(dir);
                foreach (var file in Directory.GetFiles(dir))
                {
                    yield return new ImageData { ImagePath = file, Label = label };
                }
            }
        }

        public void TrainModel()
        {
            var images = LoadImagesFromFolder(_imagesFolder).ToList();
            IDataView dataView = _mlContext.Data.LoadFromEnumerable(images);

            // Shuffle and split
            dataView = _mlContext.Data.ShuffleRows(dataView);
            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

            var pipeline = _mlContext.Transforms.Conversion.MapValueToKey("LabelKey", "Label")
                .Append(_mlContext.Transforms.LoadRawImageBytes("Image", null, "ImagePath"))
                .Append(_mlContext.MulticlassClassification.Trainers.ImageClassification(
                    new Microsoft.ML.Vision.ImageClassificationTrainer.Options
                    {
                        FeatureColumnName = "Image",
                        LabelColumnName = "LabelKey",
                        Arch = Microsoft.ML.Vision.ImageClassificationTrainer.Architecture.ResnetV2101,
                        Epoch = 50,
                        BatchSize = 10
                    }))
                .Append(_mlContext.Transforms.Conversion.MapKeyToValue("PredictedLabel"));

            _model = pipeline.Fit(split.TrainSet);

            var predictions = _model.Transform(split.TestSet);
            var metrics = _mlContext.MulticlassClassification.Evaluate(predictions, labelColumnName: "LabelKey");
            Console.WriteLine($"Micro Accuracy: {metrics.MicroAccuracy:P2}");
            Console.WriteLine($"Macro Accuracy: {metrics.MacroAccuracy:P2}");

            _mlContext.Model.Save(_model, dataView.Schema, _modelPath);
        }

        public ImagePrediction PredictFromFile(string imagePath)
        {
            if (_model == null)
            {
                if (File.Exists(_modelPath))
                    _model = _mlContext.Model.Load(_modelPath, out _);
                else
                    throw new InvalidOperationException("Image model not trained yet.");
            }

            var predictionEngine = _mlContext.Model.CreatePredictionEngine<ImageData, ImagePrediction>(_model);
            return predictionEngine.Predict(new ImageData { ImagePath = imagePath });
        }
    }
}
