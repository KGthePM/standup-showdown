#!/bin/bash

echo "🎭 Starting StandUp Showdown Platform..."
echo ""

# Kill any existing processes on our ports
echo "🧹 Cleaning up any existing processes..."
kill $(lsof -t -i:3000) 2>/dev/null || echo "   Port 3000 was free"
kill $(lsof -t -i:3002) 2>/dev/null || echo "   Port 3002 was free"

echo ""
echo "🚀 Starting servers..."

# Start Joke Factory in background
echo "🎤 Starting Joke Factory on port 3000..."
node server.js &
JOKE_FACTORY_PID=$!

# Start Truth Tales in background
echo "🕵️ Starting Truth Tales on port 3002..."
cd games/truth-tales
node server.js &
TRUTH_TALES_PID=$!
cd ../..

# Wait a moment for servers to start
sleep 3

echo ""
echo "✅ All servers started!"
echo ""
echo "🎮 Your games are ready:"
echo "   🌐 Main Hub: file://$(pwd)/index.html"
echo "   🎤 Joke Factory: http://localhost:3000"
echo "   🕵️ Truth Tales: http://localhost:3002"
echo ""
echo "💡 Open index.html in your browser to choose a game!"
echo ""
echo "🛑 To stop all servers, press Ctrl+C"

# Function to cleanup when script exits
cleanup() {
    echo ""
    echo "🛑 Stopping all servers..."
    kill $JOKE_FACTORY_PID 2>/dev/null
    kill $TRUTH_TALES_PID 2>/dev/null
    echo "✅ All servers stopped!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running
wait