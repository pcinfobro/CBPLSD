import mongoose from "mongoose";
import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import axios from "axios";
import qs from "qs"; // Added missing import for qs

import { transporter } from "../config/nodemailerConfig.js";
import Deposit from "../models/depositModel.js";
import Rental from "../models/rentalModel.js";
import Ticket from "../models/ticketModel.js";
import Order from "../models/orderModel.js";
import Service from "../models/serviceModel.js";

// Helper function to safely get user email from session
const getUserEmail = (req) => {
  return req.session && req.session.userEmail ? req.session.userEmail : null;
};

const protectedRoute = (handler) => async (req, res, next) => {
  // Check if session exists and has userEmail
  const email = getUserEmail(req);
  if (!email) {
    // Set headers to prevent caching
    res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.header("Expires", "-1");
    res.header("Pragma", "no-cache");
  return res.redirect("/user/login");
  }
  try {
    // Add cache control headers to all protected responses
    res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.header("Expires", "-1");
    res.header("Pragma", "no-cache");
    return await handler(req, res);
  } catch (error) {
    next(error);
  }
};

const getUserData = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");
  return {
    username: user.username,
    email: user.email,
    balance: (user.balance || 0).toFixed(2),
    role: user.role || "Member",
    _id: user._id, // Added _id to returned user object
  };
};

class UserGetController {
  getSignUpPage = (req, res) => res.render("signup", { message: "" });
  getSignInPage = (req, res) => res.render("signin", { message: "" });
  getForgotPassword = (req, res) =>
    res.render("forgot-password", { message: "" });
  getChangePassword = (req, res) =>
    protectedRoute(() => res.render("change-password", { message: "" }))(
      req,
      res
    );

  getTemporaryNumberPage = protectedRoute(async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail });
      const services = [
        { name: "Google", price: 0.5 },
        { name: "Facebook", price: 0.75 },
        // Add more services as needed
      ];
      res.render("temporary-number-s1", { user, services });
    } catch (error) {
      console.error("Error loading temporary number page:", error);
      res
        .status(500)
        .render("error", { message: "Error loading temporary number page" });
    }
  });

  getRentalNumberPage = protectedRoute(async (req, res) => {
    try {
      // Use a more efficient user query with only needed fields
      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail })
        .select('username email balance role')
        .lean();
      
      if (!user) {
  return res.redirect("/user/login");
      }

      // Use Promise.all to run queries in parallel for better performance
      const [services] = await Promise.all([
        Service.find({ available: { $ne: '0' } }) // Only fetch available services
          .select("name ltr_short_price ltr_price")
          .limit(50) // Limit to prevent excessive data
          .lean(),
      ]);

      // Format services for the dropdown - optimized
      const formattedServices = services.map((service) => ({
        name: `${service.name} ($${service.ltr_short_price || 'N/A'} - 3days / $${service.ltr_price || 'N/A'} - 30days)`,
        value: service.name,
        ltr_short_price: service.ltr_short_price,
        ltr_price: service.ltr_price,
      }));

      // Simplified states data - static for performance
      const states = [
        { name: "California", value: "CA" },
        { name: "New York", value: "NY" },
        { name: "Texas", value: "TX" },
        { name: "Florida", value: "FL" },
        { name: "Random", value: "random" },
      ];

      // Only fetch user's recent rentals to avoid loading too much data
      const rentals = await Rental.find({ userId: user._id })
        .select('service state duration number price status startDate expiresAt createdAt')
        .sort({ createdAt: -1 })
        .limit(20) // Limit to recent 20 rentals
        .lean();

      res.render("rental-number", {
        user: {
          username: user.username,
          email: user.email,
          balance: (user.balance || 0).toFixed(2),
          role: user.role || 'Member'
        },
        services: formattedServices,
        states,
        rentals,
      });
    } catch (error) {
      console.error("Error loading rental number page:", error);
      res
        .status(500)
        .render("error", { message: "Error loading rental number page" });
    }
  });
  getTicketDetailPage = protectedRoute(async (req, res) => {
    try {
      console.log("Accessing ticket:", req.params.id);

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        console.log("Invalid ticket ID format");
        return res
          .status(400)
          .render("error", { message: "Invalid ticket ID format" });
      }

      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        console.log("User not found in session");
  return res.redirect("/user/login");
      }

      const ticket = await Ticket.findOne({
        _id: req.params.id,
        userId: user._id,
      }).lean();

      if (!ticket) {
        console.log("Ticket not found or not owned by user");
        return res.status(404).render("error", {
          message: "Ticket not found or you don't have permission to view it",
        });
      }

      console.log("Rendering ticket:", ticket._id);
      res.render("ticket-detail", {
        ticket: {
          ...ticket,
          id: ticket._id.toString(),
          createdAt: ticket.createdAt || new Date(),
        },
        user: {
          username: user.username,
          email: user.email,
          role: user.role || "Member",
        },
      });
    } catch (error) {
      console.error("Ticket detail error:", error);
      res.status(500).render("error", {
        message: "Error loading ticket details",
      });
    }
  });

  getOrderHistoriesPage = protectedRoute(async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const user = await getUserData(userEmail);

      // Fetch services data for price lookup
      const services = await Service.find({})
        .select("name price ltr_price ltr_short_price")
        .lean();

      // Fetch real S1 Orders data with enhanced statistics
      const s1OrdersData = await Order.find({ userId: user._id }).sort({
        createdAt: -1,
      });

      const s1Orders = {
        total: s1OrdersData.length,
        totalSpent: s1OrdersData.reduce(
          (sum, order) => sum + (order.price || 0),
          0
        ),
        successful: s1OrdersData.filter((order) => order.status === "completed")
          .length,
        cancelled: s1OrdersData.filter((order) => order.status === "cancelled")
          .length,
        pending: s1OrdersData.filter((order) => order.status === "pending")
          .length,
        averageOrderValue:
          s1OrdersData.length > 0
            ? s1OrdersData.reduce((sum, order) => sum + (order.price || 0), 0) /
              s1OrdersData.length
            : 0,
        thisMonth: s1OrdersData.filter((order) => {
          const orderDate = new Date(order.createdAt);
          const now = new Date();
          return (
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear()
          );
        }).length,
        orders: s1OrdersData.map((order) => ({
          _id: order._id,
          createdAt: order.createdAt,
          number: order.number || "Pending...",
          service: order.service,
          pin: order.pin || "N/A",
          status: order.status,
          price: order.price || 0,
          lastMessage: order.lastMessage || "No messages yet",
          lastMessageTime: order.lastMessageTime,
          actions: order.actions || {
            hotspot: false,
            dislike: false,
            addToCart: false,
            renew: false,
          },
        })),
      };

      // S2 Orders (placeholder for future implementation)
      const s2Orders = {
        total: 0,
        totalSpent: 0,
        successful: 0,
        cancelled: 0,
        orders: [],
      };

      // Fetch real Rental data with enhanced statistics
      const rentalData = await Rental.find({ userId: user._id }).sort({
        createdAt: -1,
      });

      const now = new Date();
      const rentals = {
        total: rentalData.length,
        totalSpent: rentalData.reduce(
          (sum, rental) => sum + (rental.price || 0),
          0
        ),
        active: rentalData.filter(
          (rental) => rental.status === "active" && rental.expiresAt > now
        ).length,
        expired: rentalData.filter(
          (rental) =>
            rental.status === "expired" ||
            (rental.status === "active" && rental.expiresAt <= now)
        ).length,
        cancelled: rentalData.filter((rental) => rental.status === "cancelled")
          .length,
        averageRentalValue:
          rentalData.length > 0
            ? rentalData.reduce((sum, rental) => sum + (rental.price || 0), 0) /
              rentalData.length
            : 0,
        thisMonth: rentalData.filter((rental) => {
          const rentalDate = new Date(rental.createdAt);
          return (
            rentalDate.getMonth() === now.getMonth() &&
            rentalDate.getFullYear() === now.getFullYear()
          );
        }).length,
        shortTerm: rentalData.filter((rental) => rental.duration === "3days")
          .length,
        longTerm: rentalData.filter((rental) => rental.duration === "30days")
          .length,
        orders: rentalData.map((rental) => ({
          _id: rental._id,
          createdAt: rental.createdAt,
          number: rental.number || "Pending...",
          service: rental.service,
          status: rental.status,
          price: rental.price || 0,
          duration: rental.duration,
          expires: rental.expiresAt,
          lastMessage: rental.lastMessage || "No messages yet",
          lastMessageTime: rental.lastMessageTime,
          actions: rental.actions || {
            hotspot: false,
            dislike: false,
            addToCart: false,
          },
        })),
      };

      const pagination = {
        showingStart: 1,
        showingEnd: Math.min(10, Math.max(s1Orders.total, rentals.total)),
        total: s1Orders.total + rentals.total,
        currentPage: 1,
        totalPages: Math.ceil(Math.max(s1Orders.total, rentals.total) / 10),
      };

      res.render("order-histories", {
        user,
        s1Orders,
        s2Orders,
        rentals,
        pagination,
        services,
      });
    } catch (error) {
      console.error("Error loading order histories page:", error);
      res.status(500).render("error", {
        message: "Error loading order histories page",
      });
    }
  });
  getServices = async (req, res) => {
    try {
      const services = await Service.find({}).select("name price -_id").lean();
      res.json({
        success: true,
        services,
      });
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch services",
      });
    }
  };
  getTicketsPage = protectedRoute(async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail });
      if (!user) {
  return res.redirect("/user/login");
      }

      const tickets = await Ticket.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .lean();

      res.render("tickets", {
        user: {
          username: user.username,
          email: user.email,
          balance: (user.balance || 0).toFixed(2),
          role: user.role || "Member",
        },
        tickets: tickets.map((ticket) => ({
          ...ticket,
          id: ticket._id.toString(),
          createdAt: ticket.createdAt || new Date(),
        })),
      });
    } catch (error) {
      console.error("Error loading tickets:", error);
      res.status(500).render("error", {
        message: "Error loading tickets",
      });
    }
  });

  getDepositPage = protectedRoute(async (req, res) => {
    const userEmail = getUserEmail(req);
    const user = await getUserData(userEmail);
    const deposits = await Deposit.find({ userId: user._id }).sort({
      date: -1,
    });
    res.render("deposit", { user, deposits: deposits || [] });
  });

  getProfilePage = protectedRoute(async (req, res) => {
    try {
      // Optimized user query with only needed fields
      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail })
        .select('username email balance contactMethod contactValue role isVerified createdAt lastLogin')
        .lean();
        
      if (!user) {
  return res.redirect("/user/login");
      }

      const userBalance = Number(user.balance) || 0;

      res.render("user-profile", {
        user: {
          username: user.username,
          email: user.email,
          balance: userBalance,
          contactMethod: user.contactMethod,
          contactValue: user.contactValue,
          role: user.role || "Member",
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
      });
    } catch (error) {
      console.error("Profile page error:", error);
      res.status(500).render("error", {
        message: "Error loading profile page",
      });
    }
  });

  getActiveSessions = protectedRoute(async (req, res) => {
    try {
      res.json({
        success: true,
        data: [
          {
            id: "current",
            browser: "Chrome",
            os: "Windows 10",
            ip: req.ip,
            device: "desktop",
            lastActive: new Date(),
            current: true,
          },
        ],
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  getProfileData = protectedRoute(async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail });
      res.json({
        success: true,
        user: {
          balance: user.balance || 0,
          username: user.username,
          email: user.email,
          role: user.role || "Member",
        },
        twoFactorEnabled: user.twoFactorEnabled || false,
        notificationSettings: user.notificationSettings || {
          emailTransactions: true,
          emailPromotions: true,
          emailSecurity: true,
          inAppOrders: true,
          inAppSupport: true,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  index = protectedRoute(async (req, res) => {
    console.log('Index route accessed by user:', req.session.userEmail);
    try {
      const userEmail = getUserEmail(req);
      console.log('User email from session:', userEmail);
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        console.log('User not found, redirecting to signin');
  return res.redirect("/user/login");
      }

      console.log('User found, loading dashboard for:', user.email);
      user.lastLogin = new Date();
      await user.save();

      // Get dashboard statistics
      const totalOrders = await Order.countDocuments({ userId: user._id });
      const successOrders = await Order.countDocuments({
        userId: user._id,
        status: "completed",
      });
      const totalRentals = await Rental.countDocuments({ userId: user._id });
      const activeRentals = await Rental.countDocuments({
        userId: user._id,
        status: "active",
        expiresAt: { $gt: new Date() },
      });

      // Get news/announcements
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
        {
          title: "Welcome to CodeByPass",
          author: "System",
          date: "2025-01-01 00:00:00",
          content:
            "Welcome to our SMS verification service. Get started by ordering a temporary number.",
        },
      ];

      res.render("index", {
        user: {
          username: user.username,
          email: user.email,
          role: user.role || "Member",
          balance: (user.balance || 0).toFixed(2),
        },
        stats: {
          totalOrders,
          successOrders,
          totalRentals,
          activeRentals,
        },
        news,
      });
    } catch (error) {
      console.error(error);
      res.status(500).render("error", { message: "Error loading dashboard" });
    }
  });

  logoutUser = (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error signing out:", err);
        return res.status(500).send("Error signing out");
      }

      res.clearCookie("connect.sid");
      res.header(
        "Cache-Control",
        "private, no-cache, no-store, must-revalidate"
      );
      res.header("Expires", "-1");
      res.header("Pragma", "no-cache");

  res.redirect("/user/login");
    });
  };
}

class UserPostController {
  addTicketReply = protectedRoute(async (req, res) => {
    try {
      const { message } = req.body;
      const ticketId = req.params.id;

      console.log(`Adding reply to ticket ${ticketId}`);

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: "Message cannot be empty",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket ID",
        });
      }

      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const ticket = await Ticket.findOne({
        _id: ticketId,
        userId: user._id,
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found or access denied",
        });
      }

      const newReply = {
        sender: "user",
        content: message.trim(),
      };
      ticket.messages.push(newReply);

      if (ticket.status === "closed") {
        ticket.status = "open";
      }

      await ticket.save();
      console.log("Reply added successfully");

      try {
        const mailOptions = {
          from: process.env.EMAIL,
          to: process.env.ADMIN_EMAIL || process.env.EMAIL,
          subject: `New Reply on Ticket #${ticket._id}: ${ticket.title}`,
          html: `
                        <h2>New Reply Added</h2>
                        <p><strong>Ticket:</strong> ${ticket.title} (#${ticket._id})</p>
                        <p><strong>User:</strong> ${user.username} (${user.email})</p>
                        <p><strong>Reply:</strong></p>
                        <p>${newReply.content}</p>
                        <p>Status: ${ticket.status}</p>
                    `,
        };

        await transporter.sendMail(mailOptions);
        console.log("Notification email sent");
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
      }

      res.json({
        success: true,
        message: "Reply added successfully",
        reply: newReply,
        ticketStatus: ticket.status,
      });
    } catch (error) {
      console.error("Add reply error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to add reply",
      });
    }
  });

  createCryptoDeposit = protectedRoute(async (req, res) => {
    try {
      const { amount, currency, network } = req.body;
      const userEmail = getUserEmail(req);
      const user = await getUserData(userEmail);

      if (!amount || !currency) {
        return res.status(400).json({
          success: false,
          message: "Amount and currency are required",
        });
      }

      const payload = {
        amount: amount.toString(),
        currency: currency.toUpperCase(),
        order_id: crypto.randomBytes(12).toString("hex"),
      };

      const base64data = Buffer.from(JSON.stringify(payload)).toString(
        "base64"
      );
      const sign = crypto
        .createHash("md5")
        .update(base64data + process.env.CRYPTOMUS_API_KEY)
        .digest("hex");

      const response = await axios.post(
        "https://api.cryptomus.com/v1/payment",
        payload,
        {
          headers: {
            merchant: process.env.CRYPTOMUS_MERCHANT_ID,
            sign: sign,
            "Content-Type": "application/json",
          },
        }
      );

      const newDeposit = new Deposit({
        userId: user._id,
        amount: parseFloat(amount),
        method: `${currency} (${network})`,
        status: "pending",
        transactionId: response.data.result.uuid,
        paymentUrl: response.data.result.url,
      });

      await newDeposit.save();

      res.json({
        success: true,
        message: "Payment initiated",
        paymentUrl: response.data.result.url,
      });
    } catch (err) {
      console.error("Cryptomus payment error:", err);
      res.status(500).json({
        success: false,
        message:
          err.response?.data?.message ||
          err.message ||
          "Payment processing failed",
      });
    }
  });

  createTicket = protectedRoute(async (req, res) => {
    try {
      console.log("Creating ticket with data:", req.body);

      if (!req.body.title || !req.body.description) {
        console.log("Validation failed - missing title or description");
        return res.status(400).json({
          success: false,
          message: "Title and description are required",
        });
      }

      const user = await User.findOne({ email: getUserEmail(req) });
      if (!user) {
        console.log("User not found for email:", getUserEmail(req));
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const newTicket = new Ticket({
        userId: user._id,
        title: req.body.title,
        description: req.body.description,
        category: req.body.category || "general",
        priority: req.body.priority || "medium",
        messages: [
          {
            sender: "user",
            content: req.body.description,
          },
        ],
      });

      console.log("Saving ticket to database...");
      await newTicket.save();
      console.log("Ticket saved successfully:", newTicket);

      try {
        console.log("Preparing to send email notification...");
        const mailOptions = {
          from: process.env.EMAIL,
          to: process.env.ADMIN_EMAIL || process.env.EMAIL,
          subject: `New Support Ticket: ${req.body.title}`,
          html: `
                        <h2>New Support Ticket Created</h2>
                        <p><strong>User:</strong> ${user.username} (${
            user.email
          })</p>
                        <p><strong>Ticket ID:</strong> ${newTicket._id}</p>
                        <p><strong>Title:</strong> ${req.body.title}</p>
                        <p><strong>Category:</strong> ${
                          req.body.category || "general"
                        }</p>
                        <p><strong>Priority:</strong> ${
                          req.body.priority || "medium"
                        }</p>
                        <p><strong>Description:</strong></p>
                        <p>${req.body.description}</p>
                    `,
        };

        console.log("Sending email with options:", mailOptions);
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
      } catch (emailError) {
        console.error("Email sending failed (non-critical):", emailError);
      }

      return res.json({
        success: true,
        message: "Ticket created successfully",
        ticket: {
          _id: newTicket._id,
          title: newTicket.title,
          status: newTicket.status,
          createdAt: newTicket.createdAt,
        },
      });
    } catch (error) {
      console.error("Ticket creation failed:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
        errorDetails:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  createDeposit = protectedRoute(async (req, res) => {
    const { amount, method } = req.body;
    const userEmail = getUserEmail(req);
    const user = await getUserData(userEmail);

    const newDeposit = new Deposit({
      userId: user._id,
      amount: parseFloat(amount),
      method,
      status: "pending",
    });

    await newDeposit.save();
    res.json({
      success: true,
      message: "Deposit request received",
      deposit: newDeposit,
    });
  });

  updateProfile = protectedRoute(async (req, res) => {
    try {
      const { username, contactMethod, contactValue } = req.body;
      const userEmail = getUserEmail(req);
      const user = await User.findOneAndUpdate(
        { email: userEmail },
        {
          username,
          contactMethod,
          contactValue,
          updatedAt: new Date(),
        },
        { new: true }
      );

      // Return a redirect or success message
      res.redirect("/user/user-profile?success=Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      res.redirect(
        "/user/user-profile?error=" + encodeURIComponent(error.message)
      );
    }
  });

  closeTicket = protectedRoute(async (req, res) => {
    try {
      const ticket = await Ticket.findByIdAndUpdate(
        req.params.id,
        { status: "closed" },
        { new: true }
      );

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      res.json({
        success: true,
        message: "Ticket closed successfully",
        ticket,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  toggleTwoFactor = protectedRoute(async (req, res) => {
    try {
      const { enabled } = req.body;
      const userEmail = getUserEmail(req);
      await User.findOneAndUpdate(
        { email: userEmail },
        { twoFactorEnabled: enabled }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  toggleEmailAlerts = protectedRoute(async (req, res) => {
    try {
      const { enabled } = req.body;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  initiateRecovery = protectedRoute(async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  deactivateAccount = protectedRoute(async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      await User.findOneAndUpdate(
        { email: userEmail },
        { active: false, deactivatedAt: new Date() }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  logoutAllSessions = protectedRoute(async (req, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  revokeSession = protectedRoute(async (req, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  updateNotificationSettings = protectedRoute(async (req, res) => {
    try {
      const settings = {
        emailTransactions: req.body.emailTransactions === "on",
        emailPromotions: req.body.emailPromotions === "on",
        emailSecurity: req.body.emailSecurity === "on",
        inAppOrders: req.body.inAppOrders === "on",
        inAppSupport: req.body.inAppSupport === "on",
      };

      await User.findOneAndUpdate(
        { email: getUserEmail(req) },
        { notificationSettings: settings }
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  createUser = async (req, res) => {
    const {
      username,
      email,
      password,
      cpassword,
      contactMethod,
      telegramUsername,
      whatsappNumber,
      teamsEmail,
      slackEmail,
      discordUsername,
    } = req.body;

    if (password !== cpassword) {
      return res
        .status(400)
        .render("signup", { message: "Passwords don't match" });
    }

    if (await User.findOne({ email })) {
      return res
        .status(400)
        .render("signup", { message: "User already exists" });
    }

    // Determine the contact value based on the selected method
    let contactValue;
    switch (contactMethod) {
      case "telegram":
        contactValue = telegramUsername;
        break;
      case "whatsapp":
        contactValue = whatsappNumber;
        break;
      case "teams":
        contactValue = teamsEmail;
        break;
      case "slack":
        contactValue = slackEmail;
        break;
      case "discord":
        contactValue = discordUsername;
        break;
      default:
        return res
          .status(400)
          .render("signup", { message: "Invalid contact method" });
    }

    try {
      // Generate verification token
      const verificationToken = crypto.randomBytes(20).toString("hex");
      const verificationTokenExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ); // 24 hours

      const user = await new User({
        username,
        email,
        password: await bcrypt.hash(password, 10),
        contactMethod,
        contactValue,
        verificationToken,
        verificationTokenExpires,
      }).save();

      // Send verification email
      const verificationUrl = `${req.protocol}://${req.get(
        "host"
      )}/user/verify-email?token=${verificationToken}`;

      const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Verify Your Email - CodeBypass",
        html: `
                    <h2>Welcome to CodeBypass!</h2>
                    <p>Please verify your email address to complete your registration.</p>
                    <p>Click the link below to verify your email:</p>
                    <p><a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3563E9; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                    <p>If you didn't create an account with CodeBypass, please ignore this email.</p>
                    <p>This link will expire in 24 hours.</p>
                `,
      };

      await transporter.sendMail(mailOptions);

      res.status(201).render("signin", {
        message:
          "Registration successful! Please check your email to verify your account.",
      });
    } catch (error) {
      res.status(409).render("signup", { message: error.message });
    }
  };

  verifyEmail = async (req, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).render("error", {
          message: "Verification token is missing",
        });
      }

      const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).render("error", {
          message: "Invalid or expired verification token",
        });
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();

      res.render("signin", {
        message: "Email verified successfully! You can now log in.",
      });
    } catch (error) {
      res.status(500).render("error", {
        message: error.message || "Error verifying email",
      });
    }
  };

  resendVerification = async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified",
        });
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(20).toString("hex");
      const verificationTokenExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ); // 24 hours

      user.verificationToken = verificationToken;
      user.verificationTokenExpires = verificationTokenExpires;
      await user.save();

      // Send verification email
      const verificationUrl = `${req.protocol}://${req.get(
        "host"
      )}/user/verify-email?token=${verificationToken}`;

      const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Verify Your Email - CodeBypass",
        html: `
                    <h2>Email Verification</h2>
                    <p>Please verify your email address to complete your registration.</p>
                    <p>Click the link below to verify your email:</p>
                    <p><a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3563E9; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>This link will expire in 24 hours.</p>
                `,
      };

      await transporter.sendMail(mailOptions);

      res.json({
        success: true,
        message: "Verification email sent successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || "Error resending verification email",
      });
    }
  };

  signInUser = async (req, res) => {
    const { email, password } = req.body;
    
    console.log('Login attempt for email:', email);

    if (!req.body["g-recaptcha-response"]) {
      console.log('Login failed: Missing captcha for', email);
      return res
        .status(404)
        .render("signin", { message: "Please select captcha" });
    }

    try {
      const user = await User.findOne({ email });
      if (!user) {
        console.log('Login failed: User not found for', email);
        return res
          .status(404)
          .render("signin", { message: "User doesn't exist" });
      }

      console.log('User found:', {
        email: user.email,
        isVerified: user.isVerified,
        active: user.active !== false
      });

      if (!(await bcrypt.compare(password, user.password))) {
        console.log('Login failed: Invalid password for', email);
        return res
          .status(400)
          .render("signin", { message: "Invalid credentials" });
      }

      // Check if email is verified
      if (!user.isVerified) {
        console.log('Login failed: Email not verified for', email);
        return res.status(403).render("signin", {
          message:
            "Please verify your email first. <a href='#' id='resendVerification'>Resend verification email</a>",
        });
      }

      // Check if account is active
      if (user.active === false) {
        console.log('Login failed: Account deactivated for', email);
        return res.status(403).render("signin", {
          message: "Your account has been deactivated. Please contact support.",
        });
      }

      console.log('Login successful for:', email);
      req.session.userEmail = email;
      
      // Save session explicitly before redirect to avoid race conditions
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).render("signin", { message: "Session error occurred" });
        }
        
        console.log('Session saved successfully for:', email);
          console.log('About to redirect to /user/dashboard');
        
        // Set cache control headers
        res.header(
          "Cache-Control",
          "private, no-cache, no-store, must-revalidate"
        );
        res.header("Expires", "-1");
        res.header("Pragma", "no-cache");

        console.log('Sending success response with redirect instruction');
        
        // Instead of server redirect, send success response with redirect instruction
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Login Successful</title>
            <script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8f9fa; }
              .loading-text { margin-top: 20px; font-size: 1.2em; color: #333; }
            </style>
            <script>
              console.log('Login successful, redirecting to dashboard...');
              setTimeout(function() {
                  window.location.href = '/user/dashboard';
              }, 1200);
            </script>
          </head>
          <body>
            <lottie-player
              src="/assets/animations/loading hand blue.json"
              background="transparent"
              speed="1"
              style="width: 200px; height: 200px;"
              loop
              autoplay
            ></lottie-player>
            <div class="loading-text">Logging in... Please wait</div>
            <script>
                if (window.location.href.indexOf('/user/dashboard') === -1) {
                  window.location.href = '/user/dashboard';
              }
            </script>
          </body>
          </html>
        `);
        
        console.log('Success response sent with client-side redirect');
      });
    } catch (error) {
      console.error('Login error for', email, ':', error);
      res.status(500).render("signin", { message: error.message });
    }
  };
  forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).render("forgot-password", {
          message: "If this email exists, we've sent a password reset link",
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(20).toString("hex");
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

      user.resetToken = resetToken;
      user.resetTokenExpires = resetTokenExpires;
      await user.save();

      // Send email
      const resetUrl = `${req.protocol}://${req.get(
        "host"
      )}/user/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        from: process.env.EMAIL,
        to: email,
        subject: "Password Reset Request",
        html: `
                <h2>Password Reset</h2>
                <p>You requested a password reset. Click the link below to reset your password:</p>
                <p><a href="${resetUrl}">Reset Password</a></p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `,
      });

      res.render("signin", {
        message: "If this email exists, we've sent a password reset link",
      });
    } catch (error) {
      res.status(500).render("forgot-password", {
        message: error.message,
      });
    }
  };
  changePassword = protectedRoute(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.redirect(
        "/user/user-profile?error=" +
          encodeURIComponent("New passwords don't match")
      );
    }

    if (newPassword.length < 8) {
      return res.redirect(
        "/user/user-profile?error=" +
          encodeURIComponent("Password must be at least 8 characters long")
      );
    }

    try {
      const userEmail = getUserEmail(req);
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.redirect(
          "/user/user-profile?error=" + encodeURIComponent("User not found")
        );
      }

      // Verify old password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.redirect(
          "/user/user-profile?error=" +
            encodeURIComponent("Current password is incorrect")
        );
      }

      // Check if new password is same as old
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.redirect(
          "/user/user-profile?error=" +
            encodeURIComponent(
              "New password must be different from current password"
            )
        );
      }

      // Update password
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      // Send email notification (in background, don't await)
      transporter
        .sendMail({
          from: process.env.EMAIL,
          to: user.email,
          subject: "Password Changed Successfully",
          html: `<p>Your password has been successfully changed.</p>`,
        })
        .catch(console.error);
    } catch (error) {
      console.error("Password change error:", error);
      return res.redirect(
        "/user/user-profile?error=" +
          encodeURIComponent("An error occurred while changing password")
      );
    }
  });
}

export { protectedRoute };
export const userGetController = new UserGetController();
export const userPostController = new UserPostController();
