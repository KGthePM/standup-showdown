const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { getRandomContent, getUniqueContentForPlayers } = require('./content');

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

// Game constants
const ROUNDS = {
    SETUP_BATTLE: 1,
    PUNCHLINE_CHALLENGE: 2,
    FULL_JOKE_CREATION: 3
};

const ROUND_NAMES = {
    1: 'Setup Battle',
    2: 'Punchline Challenge', 
    3: 'Full Joke Creation'
};

const TIMER_DURATION = 90; // seconds for writing
const VOTING_DURATION = 30; // seconds for voting

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
        currentRound: 0,
        roundPhase: 'waiting', // waiting, writing, voting, results
        roundData: {
            content: [], // punchlines/setups/topics for current round
            submissions: {}, // player submissions
            votes: {}, // voting results
            timer: null
        },
        scores: {} // player scores across all rounds
    });

    return roomCode;
}

function startRound(roomCode, roundNumber) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    gameRoom.currentRound = roundNumber;
    gameRoom.roundPhase = 'writing';
    gameRoom.roundData.submissions = {};
    gameRoom.roundData.votes = {};
    
    // Clear any existing timer
    if (gameRoom.roundData.timer) {
        clearTimeout(gameRoom.roundData.timer);
        gameRoom.roundData.timer = null;
    }

    let content = [];
    let roundType = '';

    // Get content based on round type
    switch (roundNumber) {
        case ROUNDS.SETUP_BATTLE:
            content = getUniqueContentForPlayers('punchlines', gameRoom.players.length);
            roundType = 'punchlines';
            break;
        case ROUNDS.PUNCHLINE_CHALLENGE:
            content = getUniqueContentForPlayers('setups', gameRoom.players.length);
            roundType = 'setups';
            break;
        case ROUNDS.FULL_JOKE_CREATION:
            content = getUniqueContentForPlayers('topics', gameRoom.players.length);
            roundType = 'topics';
            break;
    }

    gameRoom.roundData.content = content;

    // Send round data to all players
    gameRoom.players.forEach((player, index) => {
        io.to(player.id).emit('roundStarted', {
            round: roundNumber,
            roundName: ROUND_NAMES[roundNumber],
            roundType: roundType,
            content: content[index],
            timeLimit: TIMER_DURATION
        });
    });

    console.log(`Round ${roundNumber} started in room ${roomCode} with ${gameRoom.players.length} players`);

    // Start writing timer
    gameRoom.roundData.timer = setTimeout(() => {
        console.log(`Writing timer expired for room ${roomCode}, forcing voting phase`);
        if (gameRoom.roundPhase === 'writing') {
            startVotingPhase(roomCode);
        }
    }, TIMER_DURATION * 1000);
}

function startVotingPhase(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    // Clear any existing timer
    if (gameRoom.roundData.timer) {
        clearTimeout(gameRoom.roundData.timer);
        gameRoom.roundData.timer = null;
    }

    gameRoom.roundPhase = 'voting';

    // Prepare submissions for voting (anonymized)
    const submissions = Object.entries(gameRoom.roundData.submissions).map(([playerId, submission], index) => ({
        id: index,
        text: submission,
        playerId: playerId // keep for scoring but don't send to clients
    }));

    console.log(`Voting phase started in room ${roomCode} with ${submissions.length} submissions`);

    // Send voting data to all players
    io.to(roomCode).emit('votingStarted', {
        submissions: submissions.map(s => ({ id: s.id, text: s.text })),
        timeLimit: VOTING_DURATION
    });

    // Start voting timer
    gameRoom.roundData.timer = setTimeout(() => {
        console.log(`Voting timer expired for room ${roomCode}, forcing results`);
        if (gameRoom.roundPhase === 'voting') {
            endVotingPhase(roomCode);
        }
    }, VOTING_DURATION * 1000);
}

function endVotingPhase(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    gameRoom.roundPhase = 'results';

    // Calculate scores
    const votes = gameRoom.roundData.votes;
    const submissions = Object.entries(gameRoom.roundData.submissions);
    
    // Count votes for each submission
    const voteCount = {};
    Object.values(votes).forEach(votedSubmissionId => {
        voteCount[votedSubmissionId] = (voteCount[votedSubmissionId] || 0) + 1;
    });

    // Update player scores
    submissions.forEach(([playerId, submission], index) => {
        const votesReceived = voteCount[index] || 0;
        if (!gameRoom.scores[playerId]) {
            gameRoom.scores[playerId] = 0;
        }
        gameRoom.scores[playerId] += votesReceived;
    });

    // Prepare results with player names
    const results = submissions.map(([playerId, submission], index) => {
        const player = gameRoom.players.find(p => p.id === playerId);
        return {
            playerName: player ? player.name : 'Unknown',
            submission: submission,
            votes: voteCount[index] || 0
        };
    }).sort((a, b) => b.votes - a.votes);

    // Send results
    io.to(roomCode).emit('roundResults', {
        results: results,
        scores: gameRoom.players.map(player => ({
            name: player.name,
            score: gameRoom.scores[player.id] || 0
        })).sort((a, b) => b.score - a.score)
    });

    // Check if game is complete
    if (gameRoom.currentRound >= 3) {
        // Game over
        setTimeout(() => {
            endGame(roomCode);
        }, 5000);
    } else {
        // Next round
        setTimeout(() => {
            startRound(roomCode, gameRoom.currentRound + 1);
        }, 5000);
    }

    console.log(`Round ${gameRoom.currentRound} ended in room ${roomCode}`);
}

function endGame(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    const finalScores = gameRoom.players.map(player => ({
        name: player.name,
        score: gameRoom.scores[player.id] || 0
    })).sort((a, b) => b.score - a.score);

    io.to(roomCode).emit('gameEnded', {
        winner: finalScores[0],
        finalScores: finalScores
    });

    // Reset game state
    gameRoom.gameStarted = false;
    gameRoom.currentRound = 0;
    gameRoom.roundPhase = 'waiting';
    gameRoom.scores = {};

    console.log(`Game ended in room ${roomCode}. Winner: ${finalScores[0].name}`);
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
        
        // Check if enough players (minimum 3 total, including host)
        if (gameRoom.players.length < 3) {
            socket.emit('error', { message: 'Need at least 3 players total to start (including host)' });
            return;
        }
        
        // Start game
        gameRoom.gameStarted = true;
        
        // Initialize scores for all players (including host)
        gameRoom.players.forEach(player => {
            gameRoom.scores[player.id] = 0;
        });
        
        // Notify all players that game is starting
        io.to(roomCode).emit('gameStarting', {
            message: `Game starting with ${gameRoom.players.length} players! Everyone participates - even the host!`,
            totalPlayers: gameRoom.players.length
        });
        
        // Start first round after a brief delay
        setTimeout(() => {
            startRound(roomCode, ROUNDS.SETUP_BATTLE);
        }, 2000);
        
        console.log(`Game started in room ${roomCode} with ${gameRoom.players.length} total players (including host)`);
    });

    // Handle player submissions
    socket.on('submitAnswer', ({ roomCode, answer }) => {
        const gameRoom = gameRooms.get(roomCode);
        
        if (!gameRoom || gameRoom.roundPhase !== 'writing') {
            socket.emit('error', { message: 'Cannot submit at this time' });
            return;
        }
        
        // Store the submission
        gameRoom.roundData.submissions[socket.id] = answer.trim();
        
        // Check if all players have submitted
        const submissionCount = Object.keys(gameRoom.roundData.submissions).length;
        const totalPlayers = gameRoom.players.length;
        
        console.log(`🎯 Room ${roomCode}: ${submissionCount}/${totalPlayers} submissions received`);
        
        // Notify player of successful submission
        socket.emit('submissionReceived');
        
        // Notify all players of submission count
        io.to(roomCode).emit('submissionUpdate', {
            submitted: submissionCount,
            total: totalPlayers
        });
        
        // If everyone has submitted, move to voting immediately
        if (submissionCount >= totalPlayers) {
            console.log(`🚀 ALL PLAYERS SUBMITTED! Room ${roomCode}: ${submissionCount}/${totalPlayers} - Starting voting early!`);
            
            // Clear the writing timer
            if (gameRoom.roundData.timer) {
                clearTimeout(gameRoom.roundData.timer);
                gameRoom.roundData.timer = null;
                console.log(`⏰ Cleared writing timer for room ${roomCode}`);
            }
            
            // Start voting phase immediately
            startVotingPhase(roomCode);
        }
    });

    // Handle voting
    socket.on('submitVote', ({ roomCode, submissionId }) => {
        const gameRoom = gameRooms.get(roomCode);
        
        if (!gameRoom || gameRoom.roundPhase !== 'voting') {
            socket.emit('error', { message: 'Cannot vote at this time' });
            return;
        }
        
        // Store the vote
        gameRoom.roundData.votes[socket.id] = submissionId;
        
        // Check if all players have voted
        const voteCount = Object.keys(gameRoom.roundData.votes).length;
        const totalPlayers = gameRoom.players.length;
        
        console.log(`🗳️ Room ${roomCode}: ${voteCount}/${totalPlayers} votes received`);
        
        // Notify player of successful vote
        socket.emit('voteReceived');
        
        // Notify all players of vote count
        io.to(roomCode).emit('voteUpdate', {
            voted: voteCount,
            total: totalPlayers
        });
        
        // If everyone has voted, end voting immediately
        if (voteCount >= totalPlayers) {
            console.log(`🎉 ALL PLAYERS VOTED! Room ${roomCode}: ${voteCount}/${totalPlayers} - Showing results early!`);
            
            // Clear the voting timer
            if (gameRoom.roundData.timer) {
                clearTimeout(gameRoom.roundData.timer);
                gameRoom.roundData.timer = null;
                console.log(`⏰ Cleared voting timer for room ${roomCode}`);
            }
            
            // End voting phase immediately
            endVotingPhase(roomCode);
        }
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
                
                // Clear any timers if game was in progress and this affects the flow
                if (gameRoom.gameStarted) {
                    // Could add logic here to handle mid-game disconnections
                }
                
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