import express from "express";
import {
  userGetController,
  userPostController,
} from "../controllers/controller.js";
import { dashboardController } from "../controllers/dashboardController.js";
import { protectedRoute } from "../controllers/controller.js";
import { paymentController } from "../controllers/paymentController.js";
import { numberController } from "../controllers/numberController.js";
import User from "../models/userModel.js";
import Rental from "../models/rentalModel.js";
import bcrypt from "bcrypt";

const router = express.Router();

// API Protection middleware (for JSON responses)
const protectedAPIRoute = async (req, res, next) => {
  const email = req.session.userEmail;
  
  if (!email) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user; // Add user to request object
    next();
  } catch (error) {
    console.error("❌ API Auth error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

// GET Routes
router.get("/signup", userGetController.getSignUpPage);
router.get("/signin", userGetController.getSignInPage);
router.get("/forgot-password", userGetController.getForgotPassword);
router.get("/index", userGetController.index);
router.get("/signout", userGetController.logoutUser);
router.get("/user/profile", userGetController.getProfilePage);
router.post("/update-profile", userPostController.updateProfile);
router.post("/user/toggle-two-factor", userPostController.toggleTwoFactor);
router.post("/user/toggle-email-alerts", userPostController.toggleEmailAlerts);
router.post("/user/initiate-recovery", userPostController.initiateRecovery);
router.post("/user/deactivate-account", userPostController.deactivateAccount);
router.post("/user/logout-all-sessions", userPostController.logoutAllSessions);
router.get("/user/api/sessions", userGetController.getActiveSessions);
router.delete("/user/api/sessions/:id", userPostController.revokeSession);
// router.get("/user/api/profile-data", userGetController.getProfileData);
router.post(
  "/user/update-notifications",
  userPostController.updateNotificationSettings
);

// Add these routes with your other routes - both /api/ and /user/api/ paths for compatibility
router.post("/api/buy-number", protectedAPIRoute, numberController.buyNumber);
router.post("/user/api/buy-number", protectedAPIRoute, numberController.buyNumber);
router.get("/api/check-sms/:id", protectedAPIRoute, numberController.checkSMS);
router.get("/user/api/check-sms/:id", protectedAPIRoute, numberController.checkSMS);
router.get("/api/request-status/:id", protectedAPIRoute, numberController.getRequestStatus);
router.get("/user/api/request-status/:id", protectedAPIRoute, numberController.getRequestStatus);
router.post("/api/reject-mdn/:id", protectedAPIRoute, numberController.rejectMDN);
router.post("/user/api/reject-mdn/:id", protectedAPIRoute, numberController.rejectMDN);
router.post("/api/renew-order/:id", protectedAPIRoute, numberController.renewOrder);
router.post("/user/api/renew-order/:id", protectedAPIRoute, numberController.renewOrder);
router.get("/api/orders", protectedAPIRoute, numberController.getUserOrders);
router.get("/user/api/orders", protectedAPIRoute, numberController.getUserOrders);
router.post("/user/api/orders/:id/action", protectedAPIRoute, numberController.toggleOrderAction);
router.get("/api/services", userGetController.getServices);
router.get("/user/api/services", userGetController.getServices);
router.get("/api/test-tellabot", numberController.testTellabotAPI);
router.get(
  "/api/profile-data",
  protectedRoute,
  userGetController.getProfileData
);
router.get(
  "/user/api/profile-data",
  protectedRoute,
  userGetController.getProfileData
);
router.get(
  "/api/dashboard",
  protectedAPIRoute,
  dashboardController.getDashboardStats
);
router.get("/tickets/:id", userGetController.getTicketDetailPage);

// Protected GET Routes
router.get("/change-password", userGetController.getChangePassword);
router.get("/tickets", userGetController.getTicketsPage);
router.get("/deposit", userGetController.getDepositPage);
router.get("/deposit/history", paymentController.getDeposits);
router.get("/user-profile", userGetController.getProfilePage);
router.get("/verify-email", userPostController.verifyEmail);

// Add these GET routes near your other GET routes
router.get("/temporary-number-s1", userGetController.getTemporaryNumberPage);
router.get("/rental-number", userGetController.getRentalNumberPage);
router.get("/order-histories", userGetController.getOrderHistoriesPage);
router.get("/api/services", userGetController.getServices);

// POST Routes
router.post("/signup", userPostController.createUser);
router.post("/signin", userPostController.signInUser);
router.post("/forgot-password", userPostController.forgotPassword);
router.post("/change-password", userPostController.changePassword);
router.post("/deposit", userPostController.createDeposit);
router.post("/tickets", userPostController.createTicket);
router.post("/tickets/:id/reply", userPostController.addTicketReply);
router.post("/tickets/:id/close", userPostController.closeTicket);
router.post("/tickets/:id/reply", userPostController.addTicketReply);
router.post("/deposit/crypto", paymentController.createPayment);
router.post(
  "/payment/webhook",
  express.json(),
  paymentController.paymentWebhook
);
router.post("/resend-verification", userPostController.resendVerification);

// Set Content-Type for all API routes - MOVED HERE BEFORE API ROUTES
router.use("/api", (req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

// Add this test route before the rental routes for debugging
router.get("/api/test", protectedAPIRoute, (req, res) => {
  console.log("🧪 Test API endpoint called");
  res.json({ success: true, message: "API is working", timestamp: new Date() });
});

// Add unprotected test endpoint to check basic connectivity
router.get("/api/ping", (req, res) => {
  console.log("🏓 Ping endpoint called - no auth required");
  res.json({
    success: true,
    message: "Pong! Server is responding",
    timestamp: new Date(),
  });
});

// In routes/routes.js
router.get("/api/rentals", protectedAPIRoute, async (req, res) => {
  try {
    console.log("📝 GET /user/api/rentals called");
    console.log("User from middleware:", req.user.username);

    const rentals = await Rental.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    console.log("📊 Found", rentals.length, "rentals for user");
    console.log("Rentals:", rentals);

    res.json({ success: true, rentals });
  } catch (error) {
    console.error("❌ Error loading rentals:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/api/rentals/create", protectedAPIRoute, async (req, res) => {
  try {
    console.log("📝 POST /user/api/rentals/create called");
    console.log("Request body:", req.body);

    const { service, state, duration, price } = req.body;
    const user = req.user; // Get user from middleware

    console.log("✅ User found:", user.username, "Balance:", user.balance);

    // Check user balance
    if (user.balance < parseFloat(price)) {
      console.log(
        "❌ Insufficient balance:",
        user.balance,
        "<",
        parseFloat(price)
      );
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (duration === "3days" ? 3 : 30));

    console.log("Creating rental with data:", {
      userId: user._id,
      service,
      state,
      duration,
      price: parseFloat(price),
      expiresAt,
    });

    // Create rental
    const rental = new Rental({
      userId: user._id,
      service,
      state,
      duration, // Add the missing duration field
      price: parseFloat(price),
      status: "active",
      expiresAt,
    });

    await rental.save();
    console.log("✅ Rental saved:", rental._id);

    // Deduct from user balance
    user.balance -= parseFloat(price);
    await user.save();
    console.log("✅ User balance updated:", user.balance);

    res.json({
      success: true,
      message: "Rental created successfully",
      rental,
    });
  } catch (error) {
    console.error("❌ Error creating rental:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rental action routes
router.get("/api/rentals/:id/messages", protectedAPIRoute, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userEmail });
    const rental = await Rental.findOne({
      _id: req.params.id,
      userId: user._id,
    });

    if (!rental) {
      return res
        .status(404)
        .json({ success: false, message: "Rental not found" });
    }

    // For now, return empty messages - you can implement actual SMS checking later
    res.json({ success: true, messages: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/api/rentals/:id/extend", protectedAPIRoute, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userEmail });
    const rental = await Rental.findOne({
      _id: req.params.id,
      userId: user._id,
    });

    if (!rental) {
      return res
        .status(404)
        .json({ success: false, message: "Rental not found" });
    }

    // Calculate extension price (same as original price)
    const extensionPrice = rental.price;

    if (user.balance < extensionPrice) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });
    }

    // Extend expiration date
    const extensionDays = rental.duration === "3days" ? 3 : 30;
    rental.expiresAt = new Date(
      rental.expiresAt.getTime() + extensionDays * 24 * 60 * 60 * 1000
    );
    await rental.save();

    // Deduct from user balance
    user.balance -= extensionPrice;
    await user.save();

    res.json({ success: true, message: "Rental extended successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/api/rentals/:id/cancel", protectedAPIRoute, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userEmail });
    const rental = await Rental.findOne({
      _id: req.params.id,
      userId: user._id,
    });

    if (!rental) {
      return res
        .status(404)
        .json({ success: false, message: "Rental not found" });
    }

    if (rental.status !== "active") {
      return res
        .status(400)
        .json({ success: false, message: "Can only cancel active rentals" });
    }

    // Update rental status
    rental.status = "cancelled";
    await rental.save();

    res.json({ success: true, message: "Rental cancelled successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle action for rental (hotspot, dislike, cart)
router.post(
  "/api/rentals/:id/toggle-action",
  protectedAPIRoute,
  async (req, res) => {
    try {
      const user = await User.findOne({ email: req.session.userEmail });
      const rental = await Rental.findOne({
        _id: req.params.id,
        userId: user._id,
      });

      if (!rental) {
        return res
          .status(404)
          .json({ success: false, message: "Rental not found" });
      }

      const { action } = req.body;

      // Initialize actions object if it doesn't exist
      if (!rental.actions) {
        rental.actions = {};
      }

      // Toggle the specific action
      rental.actions[action] = !rental.actions[action];

      // Mark the actions field as modified for Mongoose
      rental.markModified("actions");
      await rental.save();

      res.json({
        success: true,
        message: `${action} toggled successfully`,
        action: action,
        state: rental.actions[action],
      });
    } catch (error) {
      console.error("Toggle action error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Renew rental
router.post("/api/rentals/:id/renew", protectedAPIRoute, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userEmail });
    const rental = await Rental.findOne({
      _id: req.params.id,
      userId: user._id,
    });

    if (!rental) {
      return res
        .status(404)
        .json({ success: false, message: "Rental not found" });
    }

    // Check user balance (renew for same price)
    if (user.balance < rental.price) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance to renew rental",
      });
    }

    // Calculate new expiration date based on original duration
    const daysToAdd = rental.duration === "3days" ? 3 : 30;
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + daysToAdd);

    // Update rental
    rental.expiresAt = newExpiresAt;
    rental.status = "active"; // Reactivate if expired
    await rental.save();

    // Deduct from user balance
    user.balance -= rental.price;
    await user.save();

    res.json({
      success: true,
      message: "Rental renewed successfully",
      newExpiresAt: newExpiresAt,
      newBalance: user.balance,
    });
  } catch (error) {
    console.error("Renew rental error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/reset-password", (req, res) => {
  const { token } = req.query;
  res.render("reset-password", { token, message: "" });
});

router.post("/reset-password", async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  try {
    if (password !== confirmPassword) {
      return res.render("reset-password", {
        token,
        message: "Passwords don't match",
      });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("reset-password", {
        token,
        message: "Invalid or expired token",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.render("signin", {
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    res.render("reset-password", {
      token,
      message: error.message,
    });
  }
});

export default router;
