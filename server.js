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

// Game content database
const gameContent = {
    setups: [
        "I went to buy some camouflage pants the other day but...",
        "My therapist says I have a preoccupation with vengeance...",
        "I told my wife she was drawing her eyebrows too high...",
        "I haven't slept for ten days because...",
        "My dog used to chase people on a bike a lot...",
        "I bought the world's worst thesaurus yesterday...",
        "I was wondering why the ball kept getting bigger and bigger...",
        "My friend thinks he is smart. He told me an onion is the only food that makes you cry...",
        "I used to hate facial hair but...",
        "My wife told me to stop singing 'Wonderwall'..."
    ],
    punchlines: [
        "couldn't find any!",
        "We'll see about that.",
        "She looked surprised.",
        "that would be too long.",
        "It got so bad I had to take his bike away.",
        "Not only was it terrible, it was also terrible.",
        "Then it hit me.",
        "So I threw a coconut at his face.",
        "then it grew on me.",
        "I said maybe..."
    ],
    topics: [
        "Social Media",
        "Dating Apps",
        "Working from Home",
        "Fast Food",
        "Public Transportation",
        "Gym Memberships",
        "Weather Apps",
        "Online Shopping",
        "Video Calls",
        "Autocorrect"
    ]
};

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

function getRandomContent(type, count = 1) {
    const content = gameContent[type];
    const shuffled = [...content].sort(() => 0.5 - Math.random());
    return count === 1 ? shuffled[0] : shuffled.slice(0, count);
}

function createGameRoom() {
    let roomCode;
    do {
        roomCode = generateRoomCode();
    } while (gameRooms.has(roomCode));

    gameRooms.set(roomCode, {
        players: [],
        host: null,
        gameStarted: false,
        currentRound: 0,
        roundData: null,
        submissions: new Map(),
        votes: new Map(),
        roundTimer: null,
        phase: 'waiting' // waiting, submitting, voting, results
    });

    return roomCode;
}

function startRound(roomCode, roundNumber) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    gameRoom.currentRound = roundNumber;
    gameRoom.submissions.clear();
    gameRoom.votes.clear();
    gameRoom.phase = 'submitting';

    let roundData = {};
    let roundName = '';
    let instruction = '';

    switch (roundNumber) {
        case 1: // Setup Battle
            roundName = 'Setup Battle';
            roundData.punchline = getRandomContent('punchlines');
            instruction = `Write a setup for this punchline: "${roundData.punchline}"`;
            break;
        case 2: // Punchline Challenge
            roundName = 'Punchline Challenge';
            roundData.setup = getRandomContent('setups');
            instruction = `Write a punchline for this setup: "${roundData.setup}"`;
            break;
        case 3: // Full Joke Creation
            roundName = 'Full Joke Creation';
            roundData.topic = getRandomContent('topics');
            instruction = `Write a complete joke about: ${roundData.topic}`;
            break;
    }

    gameRoom.roundData = roundData;

    // Send round start to all players
    io.to(roomCode).emit('roundStarted', {
        round: roundNumber,
        roundName,
        instruction,
        roundData,
        timeLimit: 90 // 90 seconds to submit
    });

    // Start submission timer
    gameRoom.roundTimer = setTimeout(() => {
        startVotingPhase(roomCode);
    }, 90000);
}

function startVotingPhase(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    gameRoom.phase = 'voting';
    
    // Get all submissions
    const submissions = Array.from(gameRoom.submissions.entries()).map(([playerId, submission]) => {
        const player = gameRoom.players.find(p => p.id === playerId);
        return {
            id: playerId,
            playerName: player.name,
            text: submission
        };
    });

    // Send voting phase to all players
    io.to(roomCode).emit('votingStarted', {
        submissions: submissions,
        timeLimit: 60 // 60 seconds to vote
    });

    // Start voting timer
    gameRoom.roundTimer = setTimeout(() => {
        showResults(roomCode);
    }, 60000);
}

function showResults(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    gameRoom.phase = 'results';

    // Calculate vote results
    const voteCount = new Map();
    gameRoom.votes.forEach(votedFor => {
        voteCount.set(votedFor, (voteCount.get(votedFor) || 0) + 1);
    });

    // Find winner(s)
    let maxVotes = 0;
    let winners = [];
    voteCount.forEach((votes, playerId) => {
        if (votes > maxVotes) {
            maxVotes = votes;
            winners = [playerId];
        } else if (votes === maxVotes) {
            winners.push(playerId);
        }
    });

    // Award points
    winners.forEach(winnerId => {
        const player = gameRoom.players.find(p => p.id === winnerId);
        if (player) {
            player.score += 100;
        }
    });

    // Prepare results data
    const results = Array.from(gameRoom.submissions.entries()).map(([playerId, submission]) => {
        const player = gameRoom.players.find(p => p.id === playerId);
        const votes = voteCount.get(playerId) || 0;
        const isWinner = winners.includes(playerId);
        return {
            playerName: player.name,
            text: submission,
            votes,
            isWinner
        };
    }).sort((a, b) => b.votes - a.votes);

    // Send results
    io.to(roomCode).emit('roundResults', {
        results,
        winners: winners.map(id => gameRoom.players.find(p => p.id === id).name),
        players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
    });

    // Schedule next round or end game
    setTimeout(() => {
        if (gameRoom.currentRound < 3) {
            startRound(roomCode, gameRoom.currentRound + 1);
        } else {
            endGame(roomCode);
        }
    }, 10000); // 10 seconds to view results
}

function endGame(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    // Find overall winner
    const sortedPlayers = [...gameRoom.players].sort((a, b) => b.score - a.score);
    const gameWinner = sortedPlayers[0];

    io.to(roomCode).emit('gameEnded', {
        winner: gameWinner.name,
        finalScores: sortedPlayers.map(p => ({ name: p.name, score: p.score }))
    });

    // Reset game state
    gameRoom.gameStarted = false;
    gameRoom.currentRound = 0;
    gameRoom.phase = 'waiting';
    gameRoom.players.forEach(p => p.score = 0);
}

// Socket.io event handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Create a new game room
    socket.on('createRoom', ({ playerName }) => {
        const roomCode = createGameRoom();
        const gameRoom = gameRooms.get(roomCode);
        
        gameRoom.host = socket.id;
        gameRoom.players.push({
            id: socket.id,
            name: playerName,
            isHost: true,
            score: 0
        });
        
        socket.join(roomCode);
        
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
        
        if (!gameRooms.has(roomCode)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const gameRoom = gameRooms.get(roomCode);
        
        if (gameRoom.gameStarted) {
            socket.emit('error', { message: 'Game already in progress' });
            return;
        }
        
        if (gameRoom.players.length >= 6) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }
        
        if (gameRoom.players.some(p => p.name === playerName)) {
            socket.emit('error', { message: 'Name already taken in this room' });
            return;
        }
        
        gameRoom.players.push({
            id: socket.id,
            name: playerName,
            isHost: false,
            score: 0
        });
        
        socket.join(roomCode);
        
        socket.emit('roomJoined', { 
            roomCode,
            isHost: false,
            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
        });
        
        io.to(roomCode).emit('playerJoined', { 
            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
        });
        
        console.log(`Player ${playerName} joined room ${roomCode}`);
    });

    // Start the game
    socket.on('startGame', ({ roomCode }) => {
        const gameRoom = gameRooms.get(roomCode);
        
        if (!gameRoom) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        if (gameRoom.host !== socket.id) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }
        
        if (gameRoom.players.length < 3) {
            socket.emit('error', { message: 'Need at least 3 players to start' });
            return;
        }
        
        gameRoom.gameStarted = true;
        
        io.to(roomCode).emit('gameStarted', { 
            message: 'Game is starting! Get ready for Round 1: Setup Battle!'
        });
        
        // Start first round after a brief delay
        setTimeout(() => {
            startRound(roomCode, 1);
        }, 3000);
        
        console.log(`Game started in room ${roomCode}`);
    });

    // Handle player submissions
    socket.on('submitAnswer', ({ roomCode, answer }) => {
        const gameRoom = gameRooms.get(roomCode);
        
        if (!gameRoom || gameRoom.phase !== 'submitting') {
            socket.emit('error', { message: 'Not accepting submissions right now' });
            return;
        }
        
        gameRoom.submissions.set(socket.id, answer.trim());
        
        socket.emit('submissionReceived', { message: 'Your answer has been submitted!' });
        
        // Check if all players have submitted
        if (gameRoom.submissions.size === gameRoom.players.length) {
            clearTimeout(gameRoom.roundTimer);
            startVotingPhase(roomCode);
        }
    });

    // Handle voting
    socket.on('submitVote', ({ roomCode, votedFor }) => {
        const gameRoom = gameRooms.get(roomCode);
        
        if (!gameRoom || gameRoom.phase !== 'voting') {
            socket.emit('error', { message: 'Not accepting votes right now' });
            return;
        }
        
        // Can't vote for yourself
        if (votedFor === socket.id) {
            socket.emit('error', { message: 'You cannot vote for yourself!' });
            return;
        }
        
        gameRoom.votes.set(socket.id, votedFor);
        
        socket.emit('voteReceived', { message: 'Your vote has been submitted!' });
        
        // Check if all players have voted
        if (gameRoom.votes.size === gameRoom.players.length) {
            clearTimeout(gameRoom.roundTimer);
            showResults(roomCode);
        }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        for (const [roomCode, gameRoom] of gameRooms.entries()) {
            const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const player = gameRoom.players[playerIndex];
                gameRoom.players.splice(playerIndex, 1);
                
                // Clean up game state
                gameRoom.submissions.delete(socket.id);
                gameRoom.votes.delete(socket.id);
                
                if (gameRoom.host === socket.id) {
                    if (gameRoom.players.length > 0) {
                        gameRoom.host = gameRoom.players[0].id;
                        gameRoom.players[0].isHost = true;
                        
                        io.to(roomCode).emit('hostChanged', { 
                            newHost: gameRoom.players[0].name,
                            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
                        });
                    } else {
                        gameRooms.delete(roomCode);
                        continue;
                    }
                }
                
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