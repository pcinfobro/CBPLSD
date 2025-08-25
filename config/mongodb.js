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
    const connectionOptions = {
      maxPoolSize: 10,         // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000,  // Close sockets after 45 seconds of inactivity
      family: 4,               // Use IPv4, skip trying IPv6
      maxIdleTimeMS: 30000,    // Close connections after 30s of inactivity
      retryWrites: true,
      w: "majority",
      tls: true,
      tlsAllowInvalidCertificates: false,
      // Connection pool events for monitoring
      monitorCommands: process.env.NODE_ENV === 'development'
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
