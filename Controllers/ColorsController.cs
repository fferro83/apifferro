using Microsoft.AspNetCore.Mvc;
using NewAPI.Services;
using Microsoft.AspNetCore.Authorization;

namespace NewAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ColorsController : ControllerBase
{
    private readonly ColorService _colorService;

    public ColorsController(ColorService colorService)
    {
        _colorService = colorService;
    }

    [HttpGet]
    public IActionResult GetAllColors()
    {
        return Ok(_colorService.GetHexColors());
    }

    [HttpGet("{color}")]
    public IActionResult GetColor(string color)
    {
        var hex = _colorService.GetHexColor(color);

        if (hex is null)
            return NotFound($"El color '{color}' no está disponible.");

        return Ok(new { color, hex });
    }
}
