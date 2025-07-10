const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game rooms storage
const gameRooms = new Map();

// Helper functions
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function createGameRoom() {
    let roomCode;
    // Ensure unique room code
    do {
        roomCode = generateRoomCode();
    } while (gameRooms.has(roomCode));

    // Initialize game room state
    gameRooms.set(roomCode, {
        players: [],
        host: null,
        gameStarted: false,
        currentRound: 0
    });

    return roomCode;
}

// Socket.io event handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Create a new game room
    socket.on('createRoom', ({ playerName }) => {
        const roomCode = createGameRoom();
        const gameRoom = gameRooms.get(roomCode);
        
        // Set this socket as the host
        gameRoom.host = socket.id;
        
        // Add player to the room
        gameRoom.players.push({
            id: socket.id,
            name: playerName,
            isHost: true,
            score: 0
        });
        
        // Join socket.io room
        socket.join(roomCode);
        
        // Send room code back to client
        socket.emit('roomCreated', { 
            roomCode, 
            isHost: true,
            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
        });
        
        console.log(`Room created: ${roomCode} by ${playerName}`);
    });

    // Join an existing game room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        
        // Check if room exists
        if (!gameRooms.has(roomCode)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const gameRoom = gameRooms.get(roomCode);
        
        // Check if game already started
        if (gameRoom.gameStarted) {
            socket.emit('error', { message: 'Game already in progress' });
            return;
        }
        
        // Check if room is full (max 6 players)
        if (gameRoom.players.length >= 6) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }
        
        // Check if player name is unique in this room
        if (gameRoom.players.some(p => p.name === playerName)) {
            socket.emit('error', { message: 'Name already taken in this room' });
            return;
        }
        
        // Add player to the room
        gameRoom.players.push({
            id: socket.id,
            name: playerName,
            isHost: false,
            score: 0
        });
        
        // Join socket.io room
        socket.join(roomCode);
        
        // Send room info back to client
        socket.emit('roomJoined', { 
            roomCode,
            isHost: false,
            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
        });
        
        // Notify all players in the room about the new player
        io.to(roomCode).emit('playerJoined', { 
            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
        });
        
        console.log(`Player ${playerName} joined room ${roomCode}`);
    });

    // Start the game
    socket.on('startGame', ({ roomCode }) => {
        const gameRoom = gameRooms.get(roomCode);
        
        // Check if room exists
        if (!gameRoom) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        // Check if sender is the host
        if (gameRoom.host !== socket.id) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }
        
        // Check if enough players (minimum 3)
        if (gameRoom.players.length < 3) {
            socket.emit('error', { message: 'Need at least 3 players to start' });
            return;
        }
        
        // Start game
        gameRoom.gameStarted = true;
        gameRoom.currentRound = 1;
        
        // Notify all players in the room that the game has started
        io.to(roomCode).emit('gameStarted', { 
            round: 1,
            roundName: 'Setup Battle',
            message: 'Game is starting! Round 1: Setup Battle begins now!'
        });
        
        console.log(`Game started in room ${roomCode}`);
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Find all rooms this player is in and remove them
        for (const [roomCode, gameRoom] of gameRooms.entries()) {
            const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const player = gameRoom.players[playerIndex];
                
                // Remove player from the room
                gameRoom.players.splice(playerIndex, 1);
                
                // If the host left, assign a new host or close the room
                if (gameRoom.host === socket.id) {
                    if (gameRoom.players.length > 0) {
                        // Assign new host
                        gameRoom.host = gameRoom.players[0].id;
                        gameRoom.players[0].isHost = true;
                        
                        // Notify remaining players about host change
                        io.to(roomCode).emit('hostChanged', { 
                            newHost: gameRoom.players[0].name,
                            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
                        });
                    } else {
                        // Remove empty room
                        gameRooms.delete(roomCode);
                        continue;
                    }
                }
                
                // Notify remaining players about player leaving
                io.to(roomCode).emit('playerLeft', { 
                    playerName: player.name,
                    players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
                });
                
                console.log(`Player ${player.name} left room ${roomCode}`);
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT}`);
});