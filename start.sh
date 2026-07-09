#!/bin/bash
echo "🚀 Starting ERP LE CANAPÉ..."
echo ""

# Start backend server in background
echo "📡 Starting backend server on port 5001..."
cd /Users/abdoukrimi/erpcanape/server
npm run dev &
SERVER_PID=$!

# Wait a moment for server to initialize
sleep 2

# Start frontend client
echo "🎨 Starting frontend client on port 5173..."
cd /Users/abdoukrimi/erpcanape/client
npm run dev &
CLIENT_PID=$!

echo ""
echo "✅ Both servers are starting!"
echo "   Backend:  http://localhost:5001"
echo "   Frontend: http://localhost:5173"
echo "   Network:  http://172.20.10.3:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C to kill both processes
trap "echo 'Stopping servers...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for either process to exit
wait
