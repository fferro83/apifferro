using Microsoft.AspNetCore.Mvc;
using NewAPI.Models;
using NewAPI.Data;
using Microsoft.AspNetCore.Authorization;

namespace NewAPI.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PersonController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PersonController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public IActionResult CreatePerson([FromBody] PersonRequest request)
        {
            if (request == null)
                return BadRequest("Invalid request");

            var person = new Person
            {
                Name = request.Name,
                Perfil = request.Perfil,
                SSN = request.SSN,
                Latitude = request.Latitude,
                Longitude = request.Longitude
            };

            _context.Persons.Add(person);
            _context.SaveChanges();

            return Ok(new
            {
                Message = "Added Successfully",
                Data = person
            });
        }
    }
}

