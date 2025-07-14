#!/bin/bash

echo "🎭 Starting StandUp Showdown Unified Platform..."
echo ""

# Kill any existing processes on port 3000
echo "🧹 Cleaning up any existing processes..."
kill $(lsof -t -i:3000) 2>/dev/null || echo "   Port 3000 was free"

echo ""
echo "🚀 Starting unified server..."

# Start the unified server
echo "🎮 Starting unified StandUp Showdown server on port 3000..."
node unified-server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

echo ""
echo "✅ Unified server started!"
echo ""
echo "🎮 Your comedy platform is ready:"
echo "   🌐 Game Hub: http://localhost:3000"
echo "   🎤 Joke Factory: http://localhost:3000/joke-factory"
echo "   🕵️ Truth Tales: http://localhost:3000/truth-tales"
echo ""
echo "🌟 Benefits of the unified server:"
echo "   ✨ Single port deployment"
echo "   🔄 Shared resources and code"
echo "   🚀 Easier maintenance and scaling"
echo "   💾 Reduced memory footprint"
echo "   🔗 Seamless game switching"
echo ""
echo "💡 Open http://localhost:3000 in your browser to start!"
echo ""
echo "🛑 To stop the server, press Ctrl+C"

# Function to cleanup when script exits
cleanup() {
    echo ""
    echo "🛑 Stopping unified server..."
    kill $SERVER_PID 2>/dev/null
    echo "✅ Server stopped!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running
wait