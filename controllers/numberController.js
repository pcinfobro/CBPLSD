import axios from "axios";
import qs from "qs";
import User from "../models/userModel.js";
import Order from "../models/orderModel.js";
import Rental from "../models/rentalModel.js";
import Service from "../models/serviceModel.js";

// Configuration from environment variables
const TELLABOT_CONFIG = {
  apiEndpoint: "https://www.codebypass.app/api_command.php",
  user: process.env.TELLABOT_USER || "Mustafiz",
  apiKey: process.env.TELLABOT_API_KEY || "ksiL3QFDyZQ1VGOrl23sG87nAqNi3gAz",
};

class NumberController {
  // Helper function to make API requests to Tellabot
  async makeTellabotRequest(params) {
    try {
      const baseParams = {
        user: TELLABOT_CONFIG.user,
        api_key: TELLABOT_CONFIG.apiKey,
      };

      const fullParams = { ...baseParams, ...params };
      const queryString = qs.stringify(fullParams);
      const url = `${TELLABOT_CONFIG.apiEndpoint}?${queryString}`;

      const response = await axios.get(url, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000,
      });

      if (!response.data) {
        throw new Error("Empty response from API");
      }

      return typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;
    } catch (error) {
      console.error("Tellabot API request failed:", error.message);
      throw error;
    }
  }

  // Extract PIN from SMS
  extractPin(sms) {
    if (!sms) return null;

    // Common PIN patterns
    const patterns = [
      /\b(\d{4,8})\b/g, // 4-8 digit numbers
      /code[:\s]*(\d+)/i, // "code: 123456"
      /verification[:\s]*(\d+)/i, // "verification: 123456"
      /pin[:\s]*(\d+)/i, // "pin: 123456"
    ];

    for (const pattern of patterns) {
      const match = sms.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  // Buy a temporary number
  buyNumber = async (req, res) => {
    try {
      console.log("Buy number request received:", req.body);

      const {
        service,
        state = "random",
        isPremium = false,
        markupPercentage = 0,
      } = req.body;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        console.log("Unauthorized access attempt");
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!service) {
        console.log("Missing service parameter");
        return res.status(400).json({
          success: false,
          message: "Service is required",
        });
      }

      // Get user and check balance
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // First get service price
      const serviceInfo = await this.makeTellabotRequest({
        cmd: "list_services",
        service,
      });

      if (
        serviceInfo.status !== "ok" ||
        !serviceInfo.message ||
        serviceInfo.message.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid service or service not available",
        });
      }

      let servicePrice = parseFloat(serviceInfo.message[0].price);

      // Apply markup for premium requests
      if (isPremium && markupPercentage > 0) {
        servicePrice = servicePrice * (1 + markupPercentage / 100);
      }

      if (user.balance < servicePrice) {
        return res.status(400).json({
          success: false,
          message: "Insufficient balance",
        });
      }

      // Request the number
      const result = await this.makeTellabotRequest({
        cmd: "request",
        service,
      });

      if (result.status !== "ok") {
        return res.status(400).json({
          success: false,
          message: result.message || "Failed to purchase number",
        });
      }

      // Deduct from user balance
      user.balance -= servicePrice;
      await user.save();

      // Create order record
      const order = new Order({
        userId: user._id,
        service,
        state,
        amount: servicePrice,
        status: "pending",
        transactionId: result.message[0].id,
        number: result.message[0].mdn,
        expiresAt: new Date(
          Date.now() + result.message[0].till_expiration * 1000
        ),
        isPremium,
        markupPercentage,
      });

      await order.save();

      res.json({
        success: true,
        message: "Number purchased successfully",
        data: result.message[0],
        order: {
          id: order._id,
          number: order.number,
          service: order.service,
          state: order.state,
          price: order.amount,
          expiresAt: order.expiresAt,
          isPremium: order.isPremium,
        },
      });
    } catch (error) {
      console.error("Buy number error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to purchase number",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  };

  // Create rental order
  createRental = async (req, res) => {
    try {
      const { service, state = "random", duration } = req.body;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!service || !duration) {
        return res.status(400).json({
          success: false,
          message: "Service and duration are required",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Get service info for rental pricing
      const serviceInfo = await Service.findOne({ name: service });
      if (!serviceInfo) {
        return res.status(404).json({
          success: false,
          message: "Service not found",
        });
      }

      // Calculate price based on duration
      const price =
        duration === "3days"
          ? parseFloat(serviceInfo.ltr_short_price || serviceInfo.price * 0.5)
          : parseFloat(serviceInfo.ltr_price || serviceInfo.price * 2);

      if (user.balance < price) {
        return res.status(400).json({
          success: false,
          message: "Insufficient balance",
        });
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (duration === "3days" ? 3 : 30));

      // Request the rental number from Tellabot API (ltr_rent)
      const result = await this.makeTellabotRequest({
        cmd: "ltr_rent",
        service,
        duration: duration === "3days" ? 3 : 30,
        autorenew: true,
      });

      if (result.status !== "ok" || !result.message || !result.message.mdn) {
        return res.status(400).json({
          success: false,
          message: result.message || "Failed to create rental",
        });
      }

      // Deduct from user balance
      user.balance -= price;
      await user.save();

      // Create rental record
      const rental = new Rental({
        userId: user._id,
        service,
        state,
        duration,
        price,
        number: result.message.mdn,
        transactionId: result.message.id,
        status: "active",
        expiresAt,
      });

      await rental.save();

      res.json({
        success: true,
        message: "Rental created successfully",
        rental: {
          id: rental._id,
          service: rental.service,
          state: rental.state,
          duration: rental.duration,
          number: rental.number,
          price: rental.price,
          status: rental.status,
          expiresAt: rental.expiresAt,
        },
      });
    } catch (error) {
      console.error("Create rental error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create rental",
      });
    }
  };

  // Release a rented MDN (Tellabot ltr_release)
  releaseRental = async (req, res) => {
    try {
      const userEmail = req.session.userEmail;
      if (!userEmail) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const { id } = req.params; // our Rental _id
      const rental = await Rental.findOne({ _id: id, userId: user._id });
      if (!rental) {
        return res.status(404).json({ success: false, message: "Rental not found" });
      }

      if (rental.status !== 'active') {
        return res.status(400).json({ success: false, message: "Can only release active rentals" });
      }

      // Build Tellabot params for ltr_release. Prefer transactionId (lts id) if present, otherwise mdn+service
      const tellabotParams = { cmd: 'ltr_release' };
      if (rental.transactionId) tellabotParams.id = rental.transactionId;
      if (rental.number) tellabotParams.mdn = rental.number;
      if (rental.service) tellabotParams.service = rental.service;

      const result = await this.makeTellabotRequest(tellabotParams);

      if (result.status !== 'ok') {
        return res.status(400).json({ success: false, message: result.message || 'Failed to release rental', tellabot: result });
      }

      rental.status = 'rejected';
      // Clear number if you want to visually indicate it's no longer usable
      // rental.number = undefined;
      await rental.save();

      return res.json({ success: true, message: 'Rental released successfully', rental: {
        id: rental._id,
        number: rental.number,
        service: rental.service,
        status: rental.status,
        transactionId: rental.transactionId,
      }, tellabot: result });
    } catch (error) {
      console.error('Release rental error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to release rental' });
    }
  };
  // In controllers/numberController.js - add this method
  getUserOrders = async (req, res) => {
    try {
      const userEmail = req.session.userEmail;
      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const { search, status, dateFrom, dateTo } = req.query;
      let filter = { userId: user._id };

      // Apply filters
      if (search) {
        filter.$or = [
          { service: { $regex: search, $options: "i" } },
          { number: { $regex: search, $options: "i" } },
          { sms: { $regex: search, $options: "i" } },
        ];
      }

      if (status && status !== "all") {
        filter.status = status;
      }

      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }

      const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        orders: orders.map((order) => ({
          id: order._id,
          _id: order._id,
          number: order.number,
          service: order.service,
          state: order.state,
          status: order.status,
          price: order.amount,
          amount: order.amount,
          createdAt: order.createdAt,
          expiresAt: order.expiresAt,
          isPremium: order.isPremium,
          actions: order.actions,

          // Original fields for backward compatibility
          sms: order.sms,
          pin: order.pin,

          // API response fields following Tellabot format
          text: order.apiResponse?.reply || order.sms,
          message: order.apiResponse?.reply || order.sms,
          reply: order.apiResponse?.reply || order.sms,
          code: order.apiResponse?.pin || order.pin,
          verification_code: order.apiResponse?.pin || order.pin,
          sms_code: order.apiResponse?.pin || order.pin,
          timestamp: order.apiResponse?.timestamp,
          date_time: order.apiResponse?.date_time,
          lastMessageTime: order.lastMessageTime,
          messageTime: order.lastMessageTime,
          receivedAt: order.lastMessageTime,

          // Include full apiResponse field for debugging and frontend logic
          apiResponse: order.apiResponse,

          // Nested sms object for compatibility
          sms: order.apiResponse
            ? {
                text: order.apiResponse.reply,
                message: order.apiResponse.reply,
                code: order.apiResponse.pin,
                pin: order.apiResponse.pin,
                timestamp: order.apiResponse.timestamp,
                date_time: order.apiResponse.date_time,
              }
            : order.sms
            ? {
                text: order.sms,
                message: order.sms,
                code: order.pin,
                pin: order.pin,
              }
            : null,
        })),
      });
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get orders",
      });
    }
  };

  // Get user rentals
  getUserRentals = async (req, res) => {
    try {
      const userEmail = req.session.userEmail;
      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const { search, status, duration } = req.query;
      let filter = { userId: user._id };

      // Apply filters
      if (search) {
        filter.$or = [
          { service: { $regex: search, $options: "i" } },
          { number: { $regex: search, $options: "i" } },
        ];
      }

      if (status && status !== "all") {
        filter.status = status;
      }

      if (duration && duration !== "all") {
        filter.duration = duration;
      }

      const rentals = await Rental.find(filter).sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        rentals: rentals.map((rental) => ({
          id: rental._id,
          service: rental.service,
          state: rental.state,
          duration: rental.duration,
          number: rental.number,
          price: rental.price,
          status: rental.status,
          startDate: rental.startDate,
          expiresAt: rental.expiresAt,
          createdAt: rental.createdAt,
        })),
      });
    } catch (error) {
      console.error("Get rentals error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get rentals",
      });
    }
  };
  // Check SMS for a purchased number
  checkSMS = async (req, res) => {
    try {
      const { id } = req.params; // This is the order ID
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const order = await Order.findOne({
        _id: id,
        userId: user._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Validate that we have a phone number
      if (!order.number || order.number === "Pending...") {
        return res.status(400).json({
          success: false,
          message: "No phone number available to check SMS",
        });
      }

      // Use Tellabot API: read_sms with service and number (mdn)
      const tellabotRes = await this.makeTellabotRequest({
        cmd: "read_sms",
        service: order.service,
        mdn: order.number,
      });

      if (tellabotRes.status === "error" && tellabotRes.message === "No messages") {
        return res.json({
          success: true,
          message: "No messages received yet",
          data: [],
          order: {
            id: order._id,
            number: order.number,
            service: order.service,
            status: order.status,
            sms: order.sms,
            pin: order.pin,
            reply: order.apiResponse?.reply,
            text: order.apiResponse?.reply,
            code: order.apiResponse?.pin,
            timestamp: order.apiResponse?.timestamp,
            date_time: order.apiResponse?.date_time,
            lastMessageTime: order.lastMessageTime,
            expiresAt: order.expiresAt,
            apiResponse: order.apiResponse,
          },
        });
      }

      if (tellabotRes.status !== "ok") {
        return res.status(400).json({
          success: false,
          message: tellabotRes.message || "Failed to check SMS",
        });
      }

      // Update order if SMS received
      if (tellabotRes.message && tellabotRes.message.length > 0) {
        const latestMessage = tellabotRes.message[tellabotRes.message.length - 1];
        try {
          order.apiResponse = { ...latestMessage };
          order.sms = latestMessage.reply;
          order.pin = latestMessage.pin;
          order.lastMessageTime = latestMessage.date_time
            ? new Date(latestMessage.date_time)
            : new Date();
          order.status = "completed";
          await order.save();
        } catch (saveError) {
          console.error("Error saving order with API response:", saveError);
        }
      }

      const responseOrder = {
        id: order._id,
        number: order.number,
        service: order.service,
        status: order.status,
        sms: order.sms,
        pin: order.pin,
        reply: order.apiResponse?.reply,
        text: order.apiResponse?.reply,
        code: order.apiResponse?.pin,
        timestamp: order.apiResponse?.timestamp,
        date_time: order.apiResponse?.date_time,
        lastMessageTime: order.lastMessageTime,
        expiresAt: order.expiresAt,
        apiResponse: order.apiResponse,
      };

      res.json({
        success: true,
        message: "SMS checked successfully",
        data: tellabotRes.message,
        order: responseOrder,
      });
    } catch (error) {
      console.error("Check SMS error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check SMS",
      });
    }
  };

  // Get request status - follows Tellabot API documentation
  getRequestStatus = async (req, res) => {
    try {
      const { id } = req.params; // This is the order ID
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const order = await Order.findOne({
        _id: id,
        userId: user._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Get request status from API
      const result = await this.makeTellabotRequest({
        cmd: "request_status",
        id: order.transactionId,
      });

      if (result.status !== "ok") {
        return res.status(400).json({
          success: false,
          message: result.message || "Failed to get request status",
        });
      }

      // Update order with latest status information
      if (result.message && result.message.length > 0) {
        const statusInfo = result.message[0];

        // Update order status based on API response
        if (statusInfo.status) {
          // Map API status to our internal status
          switch (statusInfo.status.toLowerCase()) {
            case "reserved":
              order.status = "pending";
              break;
            case "awaiting mdn":
              order.status = "pending";
              break;
            case "completed":
              order.status = "completed";
              break;
            default:
              order.status = "pending";
          }
        }

        // Update number if provided
        if (statusInfo.mdn && statusInfo.mdn !== order.number) {
          order.number = statusInfo.mdn;
        }

        await order.save();
      }

      res.json({
        success: true,
        message: "Request status retrieved successfully",
        data: result.message,
        order: {
          id: order._id,
          number: order.number,
          service: order.service,
          status: order.status,
          transactionId: order.transactionId,
          expiresAt: order.expiresAt,
        },
      });
    } catch (error) {
      console.error("Get request status error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get request status",
      });
    }
  };

  // Reject an MDN - follows Tellabot API documentation
  rejectMDN = async (req, res) => {
    try {
      const { id } = req.params; // This is the order ID
      const userEmail = req.session.userEmail;

      console.log(`=== REJECT MDN REQUEST ===`);
      console.log(`Order ID: ${id}`);
      console.log(`User Email: ${userEmail}`);

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const order = await Order.findOne({
        _id: id,
        userId: user._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      console.log(`Order found:`, {
        id: order._id,
        service: order.service,
        number: order.number,
        status: order.status,
        transactionId: order.transactionId,
      });

      if (order.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Can only reject pending orders",
        });
      }

      if (!order.transactionId) {
        return res.status(400).json({
          success: false,
          message: "Order has no transaction ID for rejection",
        });
      }

      console.log(`=== TELLABOT REJECT API CALL ===`);
      console.log(`Using transaction ID: ${order.transactionId}`);

      // Reject MDN via Tellabot API
      const result = await this.makeTellabotRequest({
        cmd: "reject",
        id: order.transactionId, // Use the Tellabot request ID
      });

      console.log(`=== TELLABOT REJECT API RESPONSE ===`);
      console.log(`Response:`, result);

      if (result.status !== "ok") {
        console.log(`=== TELLABOT REJECT FAILED ===`);
        console.log(`API Message: ${result.message}`);
        
        // If Tellabot API doesn't allow rejection, we can still mark order as failed
        // and provide refund to user (business decision)
        
        if (result.message && result.message.includes("Unable to reject")) {
          // Mark as rejected even if provider disallows explicit rejection
          order.status = "rejected";
          await order.save();
          
          // Provide refund to user since the order cannot be used
          user.balance += order.amount;
          await user.save();
          
          console.log(`=== ORDER MARKED AS FAILED (API REJECT NOT ALLOWED) ===`);
          console.log(`Order ${order._id} status updated to: ${order.status}`);
          console.log(`User refunded: $${order.amount}`);
          
          return res.json({
            success: true,
            message: "Order cancelled and refunded (API rejection not allowed for this order)",
            order: {
              id: order._id,
              number: order.number,
              service: order.service,
              status: order.status,
              transactionId: order.transactionId,
            },
            refunded: true,
            refundAmount: order.amount,
            newBalance: user.balance,
            tellabot: {
              request: { cmd: "reject", id: order.transactionId },
              response: result,
            },
          });
        }
        
        return res.status(400).json({
          success: false,
          message: result.message || "Failed to reject MDN",
          tellabot: {
            request: { cmd: "reject", id: order.transactionId },
            response: result,
          },
        });
      }

      // Update order status to rejected
      order.status = "rejected";
      await order.save();

      console.log(`=== ORDER REJECTED SUCCESSFULLY ===`);
      console.log(`Order ${order._id} status updated to: ${order.status}`);

      // Optionally refund the user (based on your business logic)
      // Uncomment the following lines if you want to refund the user
      // user.balance += order.amount;
      // await user.save();
      // console.log(`User refunded: $${order.amount}`);

      res.json({
        success: true,
        message: "MDN rejected successfully",
        order: {
          id: order._id,
          number: order.number,
          service: order.service,
          status: order.status,
          transactionId: order.transactionId,
        },
        tellabot: {
          request: { cmd: "reject", id: order.transactionId },
          response: result,
        },
      });
    } catch (error) {
      console.error("Reject MDN error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to reject MDN",
      });
    }
  };

  // Handle order actions (hotspot, dislike, add to cart, renew)
  handleOrderAction = async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const order = await Order.findOne({
        _id: id,
        userId: user._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Update the specific action
      if (["hotspot", "dislike", "addToCart", "renew"].includes(action)) {
        order.actions[action] = !order.actions[action];
        await order.save();

        res.json({
          success: true,
          message: `${action} action updated successfully`,
          actions: order.actions,
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid action",
        });
      }
    } catch (error) {
      console.error("Handle order action error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to handle action",
      });
    }
  };

  // Get services with search functionality
  getServices = async (req, res) => {
    try {
      const { search } = req.query;
      let filter = {};

      if (search) {
        filter.name = { $regex: search, $options: "i" };
      }

      const services = await Service.find(filter)
        .select("name price ltr_short_price ltr_price")
        .lean();

      res.json({
        success: true,
        services: services.map((service) => ({
          name: service.name,
          price: service.price,
          ltr_short_price: service.ltr_short_price,
          ltr_price: service.ltr_price,
        })),
      });
    } catch (error) {
      console.error("Get services error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get services",
      });
    }
  };

  // Extend rental
  extendRental = async (req, res) => {
    try {
      const { id } = req.params;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const rental = await Rental.findOne({ _id: id, userId: user._id });
      if (!rental) {
        return res.status(404).json({
          success: false,
          message: "Rental not found",
        });
      }

    // Debug log for Tellabot API response
    console.log("Tellabot API response:", JSON.stringify(result, null, 2));


      if (rental.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "Can only extend active rentals",
        });
      }
    console.log("Saving rental number:", result.message.mdn);
      // Get service info for pricing
      const serviceInfo = await Service.findOne({ name: rental.service });
      const extensionPrice =
        rental.duration === "3days"
    
          ? parseFloat(serviceInfo?.ltr_short_price || rental.price)
          : parseFloat(serviceInfo?.ltr_price || rental.price);

      if (user.balance < extensionPrice) {
        return res.status(400).json({
          success: false,
          message: "Insufficient balance for extension",
        });
      }

      // Extend the rental
      const extensionDays = rental.duration === "3days" ? 3 : 30;
      rental.expiresAt.setDate(rental.expiresAt.getDate() + extensionDays);

      // Deduct from user balance
      user.balance -= extensionPrice;
      await user.save();
      await rental.save();

      res.json({
        success: true,
        message: "Rental extended successfully",
        rental: {
          id: rental._id,
          expiresAt: rental.expiresAt,
          price: extensionPrice,
        },
      });
    } catch (error) {
      console.error("Extend rental error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to extend rental",
      });
    }
  };

  // Cancel rental
  cancelRental = async (req, res) => {
    try {
      const { id } = req.params;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const rental = await Rental.findOne({ _id: id, userId: user._id });
      if (!rental) {
        return res.status(404).json({
          success: false,
          message: "Rental not found",
        });
      }

      if (rental.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "Can only cancel active rentals",
        });
      }

      // Update rental status
      rental.status = "cancelled";
      await rental.save();

      res.json({
        success: true,
        message: "Rental cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel rental error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to cancel rental",
      });
    }
  };

  // Check rental messages (LTR uses read_sms with service + mdn)
  checkRentalMessages = async (req, res) => {
    try {
      const { id } = req.params;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const rental = await Rental.findOne({ _id: id, userId: user._id });
      if (!rental) {
        return res.status(404).json({
          success: false,
          message: "Rental not found",
        });
      }

      if (!rental.number) {
        return res.status(400).json({
          success: false,
          message: "No phone number available to check SMS",
        });
      }

      const result = await this.makeTellabotRequest({
        cmd: "read_sms",
        service: rental.service,
        mdn: rental.number,
      });

      if (result.status === "ok") {
        return res.json({ success: true, messages: result.message || [] });
      }

      if (result.status === "error" && result.message === "No messages") {
        return res.json({ success: true, messages: [] });
      }

      return res.status(400).json({
        success: false,
        message: result.message || "Failed to read SMS",
      });
    } catch (error) {
      console.error("Check messages error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check messages",
      });
    }
  };

  // LTR online status (ltr_status)
  ltrStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const rental = await Rental.findOne({ _id: id, userId: user._id });
      if (!rental) {
        return res.status(404).json({ success: false, message: "Rental not found" });
      }

      if (!rental.number) {
        return res.status(400).json({ success: false, message: "Rental has no MDN yet" });
      }

      const result = await this.makeTellabotRequest({
        cmd: "ltr_status",
        mdn: rental.number,
      });

      if (result.status !== "ok") {
        return res.status(400).json({ success: false, message: result.message || "Failed to get status" });
      }

      return res.json({ success: true, data: result.message });
    } catch (error) {
      console.error("LTR status error:", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to get LTR status" });
    }
  };

  // Activate LTR MDN (ltr_activate)
  ltrActivate = async (req, res) => {
    try {
      const { id } = req.params;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const rental = await Rental.findOne({ _id: id, userId: user._id });
      if (!rental) {
        return res.status(404).json({ success: false, message: "Rental not found" });
      }

      if (!rental.number) {
        return res.status(400).json({ success: false, message: "Rental has no MDN yet" });
      }

      const result = await this.makeTellabotRequest({
        cmd: "ltr_activate",
        mdn: rental.number,
      });

      if (result.status !== "ok") {
        return res.status(400).json({ success: false, message: result.message || "Failed to activate" });
      }

      return res.json({ success: true, data: result.message });
    } catch (error) {
      console.error("LTR activate error:", error);
      return res.status(500).json({ success: false, message: error.message || "Failed to activate LTR" });
    }
  };

  // Test Tellabot API endpoint for debugging
  testTellabotAPI = async (req, res) => {
    try {
      const { cmd, service, mdn, id } = req.query;

      if (!cmd) {
        return res.status(400).json({
          success: false,
          message:
            "cmd parameter is required. Examples:\n" +
            "?cmd=request&service=google\n" +
            "?cmd=read_sms&service=google&mdn=+1234567890\n" +
            "?cmd=request_status&service=google",
        });
      }

      console.log(`=== Testing Tellabot API ===`);
      console.log(`Command: ${cmd}`);
      console.log(`Service: ${service || "not provided"}`);
      console.log(`MDN: ${mdn || "not provided"}`);
      console.log(`ID: ${id || "not provided"}`);

      const params = { cmd };
      if (service) params.service = service;
      if (mdn) params.mdn = mdn;
      if (id) params.id = id;

      const result = await this.makeTellabotRequest(params);

      console.log("Test API Response:", JSON.stringify(result, null, 2));

      res.json({
        success: true,
        message: "API test completed",
        request: params,
        response: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Test API error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Test API failed",
        error: error.toString(),
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Renew Long-term Rental - using LTR API to extend rental period
  renewOrder = async (req, res) => {
    try {
      const { id } = req.params;
      const userEmail = req.session.userEmail;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Rental ID is required",
        });
      }

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      console.log(`=== RENEW LTR REQUEST ===`);
      console.log(`Rental ID: ${id}`);
      console.log(`User Email: ${userEmail}`);

      // Find the user first
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const userId = user._id;
      console.log(`User ID: ${userId}`);

      // Find the original rental
      const originalRental = await Rental.findOne({ _id: id, userId: userId });
      if (!originalRental) {
        return res.status(404).json({
          success: false,
          message: "Original rental not found",
        });
      }

      console.log(`Original rental found:`, {
        id: originalRental._id,
        service: originalRental.service,
        number: originalRental.number,
        status: originalRental.status,
        duration: originalRental.duration,
        expiresAt: originalRental.expiresAt,
      });

      // Check if the original rental has a phone number (MDN)
      if (!originalRental.number || originalRental.number === "Pending...") {
        return res.status(400).json({
          success: false,
          message: "Cannot renew rental: No phone number assigned",
        });
      }

      // Check user balance
      if (user.balance < originalRental.price) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance for renewal. Required: $${originalRental.price}, Available: $${user.balance}`,
        });
      }

      // Convert duration to days for LTR API
      const durationInDays = originalRental.duration === "3days" ? 3 : 30;

      // Use LTR API to renew the number
      const result = await this.makeTellabotRequest({
        cmd: "ltr_rent",
        service: originalRental.service,
        duration: durationInDays,
        mdn: originalRental.number, // Request the same MDN
      });

      console.log(`=== LTR RENEW API RESPONSE ===`);
      console.log(`Response:`, result);

      if (result.status !== "ok") {
        return res.status(400).json({
          success: false,
          message: result.message || "Renewal request failed",
          ltrApiResponse: {
            request: { 
              cmd: "ltr_rent", 
              service: originalRental.service, 
              duration: durationInDays,
              mdn: originalRental.number 
            },
            response: result,
          },
        });
      }

      // Deduct balance from user
      user.balance -= originalRental.price;
      await user.save();

      // Get renewal data from API response
      const renewalData = result.message;
      
      // Calculate new expiry date (extend from current date or current expiry, whichever is later)
      const now = new Date();
      const currentExpiry = new Date(originalRental.expiresAt);
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiryDate = new Date(baseDate.getTime() + (durationInDays * 24 * 60 * 60 * 1000));

      // Create new rental for the renewal with extended expiry
      const renewedRental = new Rental({
        userId: userId,
        service: originalRental.service,
        state: originalRental.state || "US",
        duration: originalRental.duration,
        number: renewalData.mdn || originalRental.number,
        transactionId: renewalData.id, // Store LTR transaction ID
        startDate: new Date(),
        expiresAt: newExpiryDate,
        status: "active",
        price: originalRental.price,
        actions: {
          hotspot: false,
          dislike: false,
          addToCart: false,
        },
        isRenewal: true,
        originalRentalId: originalRental._id,
      });

      await renewedRental.save();

      console.log(`=== RENEWAL CREATED ===`);
      console.log(`New Rental ID: ${renewedRental._id}`);
      console.log(`Extended Expiry: ${newExpiryDate}`);
      console.log(`Renewed Rental:`, {
        id: renewedRental._id,
        service: renewedRental.service,
        number: renewedRental.number,
        price: renewedRental.price,
        status: renewedRental.status,
        isRenewal: renewedRental.isRenewal,
        expiresAt: renewedRental.expiresAt,
      });

      res.json({
        success: true,
        message: `Rental renewed successfully! Extended ${originalRental.number} for ${durationInDays} more days`,
        rental: {
          id: renewedRental._id,
          service: renewedRental.service,
          state: renewedRental.state,
          duration: renewedRental.duration,
          price: renewedRental.price,
          number: renewedRental.number,
          status: renewedRental.status,
          startDate: renewedRental.startDate,
          expiresAt: renewedRental.expiresAt,
          isRenewal: true,
          originalRentalId: originalRental._id,
          transactionId: renewedRental.transactionId,
        },
        newBalance: user.balance,
        extensionDetails: {
          previousExpiry: originalRental.expiresAt,
          newExpiry: newExpiryDate,
          daysExtended: durationInDays,
        },
        ltrApiResponse: {
          request: { 
            cmd: "ltr_rent", 
            service: originalRental.service, 
            duration: durationInDays,
            mdn: originalRental.number 
          },
          response: result,
        },
      });
    } catch (error) {
      console.error("Renew LTR error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to renew rental",
        error: error.toString(),
      });
    }
  };

  // Toggle order action (hotspot, dislike, cart) - for compatibility with frontend
  toggleOrderAction = async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const order = await Order.findOne({
        _id: id,
        userId: user._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Initialize actions object if it doesn't exist
      if (!order.actions) {
        order.actions = {};
      }

      // Toggle the specific action
      order.actions[action] = !order.actions[action];

      // Mark the actions field as modified for Mongoose
      order.markModified("actions");
      await order.save();

      res.json({
        success: true,
        message: `${action} toggled successfully`,
        action: action,
        state: order.actions[action],
      });
    } catch (error) {
      console.error("Toggle order action error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to toggle action",
      });
    }
  };

  // Toggle action for orders (hotspot, dislike, cart, etc.)
  toggleOrderAction = async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const userEmail = req.session.userEmail;

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const order = await Order.findOne({
        _id: id,
        userId: user._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Initialize actions object if it doesn't exist
      if (!order.actions) {
        order.actions = {};
      }

      // Toggle the specific action
      order.actions[action] = !order.actions[action];

      // Mark the actions field as modified for Mongoose
      order.markModified("actions");
      await order.save();

      res.json({
        success: true,
        message: `${action} toggled successfully`,
        action: action,
        state: order.actions[action],
      });
    } catch (error) {
      console.error("Toggle action error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to toggle action",
      });
    }
  };
}

export const numberController = new NumberController();
