namespace NewAPI.Services;

public class ColorService
{
    public Dictionary<string, string> GetHexColors()
    {
        return new()
        {
            { "rojo", "#FF0000" },
            { "verde", "#00FF00" },
            { "azul", "#0000FF" },
            { "amarillo", "#FFFF00" }
        };
    }

    public string? GetHexColor(string color)
    {
        var colors = GetHexColors();
        return colors.TryGetValue(color.ToLower(), out var hex) ? hex : null;
    }
}
