#!/bin/bash
# Quick setup commands for Hostinger VPS
# Run these commands one by one in your VPS terminal

# 1. Update system
apt update && apt upgrade -y

# 2. Install Node.js 18 (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# 3. Install PM2 process manager
npm install -g pm2

# 4. Install MongoDB (if not using MongoDB Atlas)
apt-get install -y mongodb
systemctl start mongodb
systemctl enable mongodb

# 5. Install Nginx (reverse proxy)
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx

# 6. Install dependencies in your app directory
cd /var/www/CBP
npm install --production

# 7. Create necessary directories
mkdir -p logs
mkdir -p public/uploads/profile-pictures

# 8. Set proper permissions
chmod -R 755 public/
chmod -R 755 views/
chmod +x deploy.sh
chmod +x start-production.sh

echo "Setup completed! Now update your .env file and run ./start-production.sh"
