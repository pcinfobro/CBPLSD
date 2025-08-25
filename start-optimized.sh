#!/bin/bash

echo "🚀 Starting optimized application..."
echo "📊 Performance improvements applied:"
echo "  ✅ Memory leak prevention"
echo "  ✅ Centralized interval management"
echo "  ✅ Request caching and deduplication"
echo "  ✅ Session cleanup middleware"
echo "  ✅ MongoDB connection optimization"
echo "  ✅ Automatic resource cleanup"
echo ""

# Kill any existing node processes
echo "🔄 Stopping existing processes..."
pkill -f "node.*app.js" || true
pkill -f "nodemon.*app.js" || true

# Wait a moment
sleep 2

# Start the application
echo "▶️ Starting application..."
npm start
