using Microsoft.AspNetCore.Mvc;
using NewAPI.Models;
using Microsoft.AspNetCore.Authorization;

namespace NewAPI.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PersonController : Controller
    {
        [HttpPost]
        public IActionResult CreatePerson([FromBody] PersonRequest request)
        {
            if (request == null)
                return BadRequest("Invalid request");

            var response = new
            {
                Message = "Persona registrada correctamente",
                Data = request
            };

            return Ok(response);
        }
    }
}
