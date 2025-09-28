#!/bin/bash
# Deployment Debugging Script
# Run this on your EC2 server to diagnose deployment issues

echo "🔍 Debugging Deployment Issues"
echo "=============================="

echo ""
echo "1️⃣ Checking if Node.js application is running..."
ps aux | grep node | grep -v grep
if [ $? -eq 0 ]; then
    echo "✅ Node.js processes found"
else
    echo "❌ No Node.js processes running"
fi

echo ""
echo "2️⃣ Checking application logs..."
if [ -f /var/log/book-review-api.log ]; then
    echo "📋 Last 20 lines of application log:"
    tail -20 /var/log/book-review-api.log
else
    echo "❌ Application log file not found at /var/log/book-review-api.log"
fi

echo ""
echo "3️⃣ Checking deployment directory..."
if [ -d /opt/book-review-api/current/backend ]; then
    echo "✅ Deployment directory exists"
    cd /opt/book-review-api/current/backend
    echo "📁 Current directory: $(pwd)"
    echo "📄 Files in directory:"
    ls -la
    
    echo ""
    echo "📦 Checking if dist directory exists..."
    if [ -d dist ]; then
        echo "✅ dist directory found"
        echo "📄 Files in dist:"
        ls -la dist/
    else
        echo "❌ dist directory not found - build may have failed"
    fi
else
    echo "❌ Deployment directory not found"
fi

echo ""
echo "4️⃣ Checking ports in use..."
echo "📡 Ports 80, 443, 3000, 5000 status:"
netstat -tlnp | grep -E ':80|:443|:3000|:5000' || echo "No processes listening on common ports"

echo ""
echo "5️⃣ Checking system resources..."
echo "💾 Memory usage:"
free -h
echo "💽 Disk usage:"
df -h /

echo ""
echo "6️⃣ Checking recent system logs..."
echo "📋 Recent system messages:"
journalctl --since "10 minutes ago" --no-pager | tail -10

echo ""
echo "7️⃣ Manual restart attempt..."
echo "🔄 Attempting to restart the application..."
cd /opt/book-review-api/current/backend

# Kill any existing processes
sudo pkill -f "node.*app.js" 2>/dev/null || true
sleep 2

# Check if dist exists and has app.js
if [ -f dist/app.js ]; then
    echo "✅ Found dist/app.js, starting application..."
    cd dist
    sudo nohup node app.js > /var/log/book-review-api.log 2>&1 &
    sleep 3
    
    # Check if it started
    ps aux | grep "node.*app.js" | grep -v grep
    if [ $? -eq 0 ]; then
        echo "✅ Application started successfully"
        
        # Test local connection
        echo "🔍 Testing local connection..."
        curl -s http://localhost:3000/health || curl -s http://localhost:5000/health || echo "❌ Local health check failed"
    else
        echo "❌ Application failed to start"
        echo "📋 Recent log entries:"
        tail -10 /var/log/book-review-api.log
    fi
else
    echo "❌ dist/app.js not found - need to rebuild"
    echo "🔄 Attempting to rebuild..."
    npm run build
    if [ $? -eq 0 ]; then
        echo "✅ Build successful, trying to start again..."
        cd dist
        sudo nohup node app.js > /var/log/book-review-api.log 2>&1 &
    else
        echo "❌ Build failed"
    fi
fi

echo ""
echo "🎯 Debugging complete!"
echo "If the application is still not working, check:"
echo "1. Environment variables (database connection, etc.)"
echo "2. Security group settings (ports 80, 443, 3000)"
echo "3. Application configuration files"
