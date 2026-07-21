const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecoguardian';

    console.log(`Connecting to MongoDB at: ${uri}`);
    // Attempt local connection with a 4-second timeout to avoid long waits
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`Local MongoDB Connection Failed: ${error.message}`);
    
    // In dev mode, fall back to memory server automatically
    if (process.env.NODE_ENV !== 'production') {
      console.log('Starting In-Memory MongoDB Server fallback...');
      try {
        mongoServer = await MongoMemoryServer.create();
        const fallbackUri = mongoServer.getUri();
        console.log(`In-Memory MongoDB Server started at: ${fallbackUri}`);
        
        const conn = await mongoose.connect(fallbackUri);
        console.log(`MongoDB Connected (In-Memory Fallback): ${conn.connection.host}`);
        
        // Update MONGODB_URI in process.env so that other parts of the backend see it
        process.env.MONGODB_URI = fallbackUri;
      } catch (fallbackError) {
        console.error(`In-Memory Fallback Failed: ${fallbackError.message}`);
        process.exit(1);
      }
    } else {
      console.error('Fatal: Cannot connect to MongoDB in production environment');
      process.exit(1);
    }
  }
};

module.exports = connectDB;
