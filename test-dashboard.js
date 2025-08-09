import { connectUsingMongoose } from "./config/mongodb.js";
import User from "./models/userModel.js";
import Rental from "./models/rentalModel.js";
import Order from "./models/orderModel.js";

async function testDashboardData() {
  try {
    await connectUsingMongoose();
    console.log("✅ Connected to database");

    // Find a test user
    const user = await User.findOne({});
    if (!user) {
      console.log("❌ No users found in database");
      return;
    }

    console.log("👤 Testing with user:", user.username);

    // Get rental statistics
    const totalRentals = await Rental.countDocuments({ userId: user._id });
    const activeRentals = await Rental.countDocuments({
      userId: user._id,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    // Get order statistics
    const totalOrders = await Order.countDocuments({ userId: user._id });
    const successOrders = await Order.countDocuments({
      userId: user._id,
      status: "completed",
    });

    console.log("📊 Dashboard Statistics:");
    console.log("- Total Rentals:", totalRentals);
    console.log("- Active Rentals:", activeRentals);
    console.log("- Total Orders:", totalOrders);
    console.log("- Success Orders:", successOrders);

    // Show sample rentals
    const sampleRentals = await Rental.find({ userId: user._id }).limit(3);
    console.log("📱 Sample Rentals:", sampleRentals);

    // Show sample orders
    const sampleOrders = await Order.find({ userId: user._id }).limit(3);
    console.log("📦 Sample Orders:", sampleOrders);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testDashboardData();
