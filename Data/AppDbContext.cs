using Microsoft.EntityFrameworkCore;

namespace NewAPI.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }
        public DbSet<Person> Persons { get; set; }
    }
}
