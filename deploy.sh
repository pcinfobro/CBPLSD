#!/bin/bash

# Hostinger Deployment Script for Node.js App
echo "Starting deployment process..."

# Set production environment
export NODE_ENV=production

# Install dependencies
echo "Installing dependencies..."
npm ci --only=production

# Create necessary directories
mkdir -p public/uploads/profile-pictures
mkdir -p logs

# Set proper permissions
chmod -R 755 public/
chmod -R 755 views/
chmod 644 .env.production

# Copy production environment file
cp .env.production .env

echo "Deployment preparation complete!"
echo "Please make sure to:"
echo "1. Update .env file with your production values"
echo "2. Install PM2 globally: npm install -g pm2"
echo "3. Start the app with PM2: pm2 start ecosystem.config.js"
