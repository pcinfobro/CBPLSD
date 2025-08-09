import { connectUsingMongoose } from "./config/mongodb.js";
import User from "./models/userModel.js";
import Rental from "./models/rentalModel.js";
import Order from "./models/orderModel.js";

async function createSampleData() {
  try {
    await connectUsingMongoose();
    console.log("✅ Connected to database");

    // Find a test user
    const user = await User.findOne({});
    if (!user) {
      console.log("❌ No users found in database");
      return;
    }

    console.log("👤 Creating sample data for user:", user.username);

    // Create sample rentals
    const sampleRentals = [
      {
        userId: user._id,
        service: "WhatsApp",
        state: "random",
        duration: "3days",
        price: 1.5,
        status: "active",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      },
      {
        userId: user._id,
        service: "Telegram",
        state: "random",
        duration: "30days",
        price: 5.0,
        status: "active",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      {
        userId: user._id,
        service: "Instagram",
        state: "random",
        duration: "3days",
        price: 2.0,
        status: "expired",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
    ];

    // Create sample orders (temporary numbers)
    const sampleOrders = [
      {
        userId: user._id,
        service: "Discord",
        country: "US",
        number: "+1234567890",
        amount: 1.25,
        status: "completed",
      },
      {
        userId: user._id,
        service: "Twitter",
        country: "US",
        number: "+1234567891",
        amount: 1.5,
        status: "completed",
      },
      {
        userId: user._id,
        service: "Facebook",
        country: "US",
        amount: 1.75,
        status: "pending",
      },
    ];

    // Insert sample data
    console.log("📱 Creating sample rentals...");
    await Rental.insertMany(sampleRentals);

    console.log("📦 Creating sample orders...");
    await Order.insertMany(sampleOrders);

    // Now get statistics
    const totalRentals = await Rental.countDocuments({ userId: user._id });
    const activeRentals = await Rental.countDocuments({
      userId: user._id,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    const totalOrders = await Order.countDocuments({ userId: user._id });
    const successOrders = await Order.countDocuments({
      userId: user._id,
      status: "completed",
    });

    console.log("📊 Updated Dashboard Statistics:");
    console.log("- Total Rentals:", totalRentals);
    console.log("- Active Rentals:", activeRentals);
    console.log("- Total Orders:", totalOrders);
    console.log("- Success Orders:", successOrders);

    console.log("✅ Sample data created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createSampleData();
