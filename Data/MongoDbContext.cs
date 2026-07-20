using MongoDB.Driver;
using NewAPI.Models;

namespace NewAPI.Data
{
    public class MongoDbContext
    {
        private readonly IMongoDatabase _database;

        public MongoDbContext(IMongoClient client)
        {
            _database = client.GetDatabase("sample_mflix");
        }

        public IMongoCollection<Person> Persons => _database.GetCollection<Person>("Persons");
    }
}
