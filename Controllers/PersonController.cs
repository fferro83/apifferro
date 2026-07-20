using Microsoft.AspNetCore.Mvc;
using NewAPI.Data;
using NewAPI.Models;

namespace NewAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PersonController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public PersonController(MongoDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public IActionResult CreatePerson([FromBody] Person request)
        {
            if (request == null)
                return BadRequest("Invalid request");

            _context.Persons.InsertOne(request);

            return Ok(new
            {
                Message = "Persona insertada correctamente en MongoDB",
                Data = request
            });
        }
    }
}