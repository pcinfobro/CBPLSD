import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MAX_RETRIES = 15;
let retryCount = 0;

// Connection events
mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to DB");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

export const connectUsingMongoose = async () => {
  try {
    if (retryCount > 0) {
      console.log(`Retrying connection (attempt ${retryCount}/${MAX_RETRIES})`);
    }

    console.log("Connecting to MongoDB...");

    const connectionOptions = {
      connectTimeoutMS: 10000, // Reduced from 30s to 10s
      socketTimeoutMS: 20000,  // Reduced from 45s to 20s
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 20,         // Increased pool size
      minPoolSize: 5,          // Added minimum pool size
      maxIdleTimeMS: 30000,    // Close connections after 30s of inactivity
      retryWrites: true,
      w: "majority",
      tls: true,
      tlsAllowInvalidCertificates: false,
    };

    await mongoose.connect(process.env.DB_URL, connectionOptions);

    console.log("MongoDB connected successfully");
    retryCount = 0;
  } catch (err) {
    console.error("Connection error:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(connectUsingMongoose, 5000);
    } else {
      console.error("Max retries reached. Application will exit.");
      process.exit(1);
    }
  }
};

// Close connection on process termination
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("Mongoose connection closed due to app termination");
  process.exit(0);
});
