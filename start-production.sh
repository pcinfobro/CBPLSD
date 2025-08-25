#!/bin/bash

# Production startup script for Hostinger VPS
echo "Starting CBP Application..."

# Navigate to app directory
cd /var/www/CBP

# Load production environment
export NODE_ENV=production

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop any existing PM2 processes
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Start the application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

echo "Application started successfully!"
echo "Use 'pm2 status' to check application status"
echo "Use 'pm2 logs' to view application logs"
echo "Use 'pm2 monit' to monitor application"
