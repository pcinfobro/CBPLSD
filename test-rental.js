// Simple test to verify rental functionality
// Run this with: node test-rental.js

console.log("Testing rental functionality...");

// Test the rental model
import mongoose from "mongoose";
import Rental from "./models/rentalModel.js";

console.log("Rental model loaded successfully");
console.log("Rental schema fields:", Object.keys(Rental.schema.paths));

// Check if all required fields are present
const requiredFields = ["userId", "service", "duration", "expiresAt", "price"];
const missingFields = requiredFields.filter(
  (field) => !Rental.schema.paths[field]
);

if (missingFields.length === 0) {
  console.log("✅ All required fields are present in the Rental model");
} else {
  console.log("❌ Missing fields in Rental model:", missingFields);
}

console.log("Test completed");
