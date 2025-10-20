#!/bin/bash

echo "🐳 Docker Performance Test for Hub-SSH"
echo "====================================="

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t hub-ssh-test .

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start the container with performance monitoring
echo "🚀 Starting container with performance monitoring..."
docker-compose up -d

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 10

# Check container health
echo "🏥 Checking container health..."
docker-compose ps

# Test connection
echo "🔗 Testing connection..."
curl -s http://localhost:8443/health

# Monitor container resources
echo "📊 Container resource usage:"
docker stats --no-stream hub-ssh_hub-ssh_1

# Test terminal performance
echo "⌨️  Testing terminal performance..."
echo "   - Open http://localhost:8443 in your browser"
echo "   - Connect to a server"
echo "   - Try copying large amounts of text"
echo "   - Check if performance is acceptable"

echo ""
echo "🔧 Performance Tips:"
echo "   - If copying is slow, try reducing terminal scrollback"
echo "   - Check Docker container memory limits"
echo "   - Ensure sufficient shared memory (shm_size)"
echo "   - Monitor CPU usage during copy operations"

echo ""
echo "📝 To monitor performance in real-time:"
echo "   docker stats hub-ssh_hub-ssh_1"
