import User from "../models/userModel.js";
import Order from "../models/orderModel.js";
import Rental from "../models/rentalModel.js";
import Deposit from "../models/depositModel.js";

class DashboardController {
  getDashboardStats = async (req, res) => {
    try {
      const user = req.user; // Get user from middleware

      if (!user) {
        return res.status(401).json({ error: true, message: "Unauthorized" });
      }

      // Use Promise.all for parallel database queries to improve performance
      const [
        totalOrders,
        successOrders,
        pendingOrders,
        totalRentals,
        activeRentals,
        recentOrders,
        recentRentals,
        totalSpent,
        rentalSpent,
        totalDeposits
      ] = await Promise.all([
        // Order statistics
        Order.countDocuments({ userId: user._id }),
        Order.countDocuments({ userId: user._id, status: "completed" }),
        Order.countDocuments({ userId: user._id, status: "pending" }),
        
        // Rental statistics
        Rental.countDocuments({ userId: user._id }),
        Rental.countDocuments({
          userId: user._id,
          status: "active",
          expiresAt: { $gt: new Date() },
        }),
        
        // Recent data with limit
        Order.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        
        Rental.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        
        // Aggregations
        Order.aggregate([
          { $match: { userId: user._id } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        
        Rental.aggregate([
          { $match: { userId: user._id } },
          { $group: { _id: null, total: { $sum: "$price" } } },
        ]),
        
        Deposit.aggregate([
          { $match: { userId: user._id, status: "completed" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
      ]);

      const totalAmountSpent = (totalSpent[0]?.total || 0) + (rentalSpent[0]?.total || 0);

      // Get news/announcements (could be from a database in a real app)
      const news = [
        {
          title: "API Documentation",
          author: "Admin",
          date: "2025-02-22 02:20:44",
          content:
            "Follow this link for API Reference: https://codebypass.com/api",
        },
        {
          title: "Deposit Bonus Offer",
          author: "Admin",
          date: "2025-04-06 14:47:47",
          content:
            "Due to recent outages we are offering a 5% bonus on deposits of $500 or more. Offer valid till 11 Apr 2026. Thank you for your continued support, in the future we will have backup power solutions to prevent issues and provide 100% uptime.",
        },
      ];

      res.json({
        success: true,
        stats: {
          totalOrders,
          successOrders,
          pendingOrders,
          totalRentals,
          activeRentals,
          currentBalance: user.balance,
          totalSpent: totalAmountSpent,
          totalDeposits: totalDeposits[0]?.total || 0,
          successRate:
            totalOrders > 0
              ? ((successOrders / totalOrders) * 100).toFixed(1)
              : 0,
        },
        recentActivity: {
          orders: recentOrders.map((order) => ({
            id: order._id,
            service: order.service,
            status: order.status,
            amount: order.amount,
            createdAt: order.createdAt,
            type: "order",
          })),
          rentals: recentRentals.map((rental) => ({
            id: rental._id,
            service: rental.service,
            status: rental.status,
            price: rental.price,
            duration: rental.duration,
            createdAt: rental.createdAt,
            expiresAt: rental.expiresAt,
            type: "rental",
          })),
        },
        news,
        user: {
          username: user.username,
          email: user.email,
          balance: user.balance,
          role: user.role,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: true, message: "Server error" });
    }
  };
}

export const dashboardController = new DashboardController();
