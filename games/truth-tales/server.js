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

// Game rooms storage for Truth Tales
const truthTalesRooms = new Map();

// Game constants
const GAME_PHASES = {
    WAITING: 'waiting',
    STORY_WRITING: 'story_writing',
    STORY_GUESSING: 'story_guessing',
    RESULTS: 'results',
    FINAL_RESULTS: 'final_results'
};

const STORY_TOPICS = [
    "Most embarrassing date moment",
    "Childhood disaster you caused",
    "Worst job interview fail",
    "Social media mishap you regret",
    "Epic cooking disaster",
    "Embarrassing parent encounter",
    "Travel nightmare story",
    "Fashion choice you regret",
    "Technology fail moment",
    "Awkward crush confession"
];

// Helper functions
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function getRandomTopic() {
    return STORY_TOPICS[Math.floor(Math.random() * STORY_TOPICS.length)];
}

function createTruthTalesRoom() {
    let roomCode;
    do {
        roomCode = generateRoomCode();
    } while (truthTalesRooms.has(roomCode));

    truthTalesRooms.set(roomCode, {
        players: [],
        host: null,
        gameStarted: false,
        currentRound: 0,
        phase: GAME_PHASES.WAITING,
        currentTopic: null,
        stories: [], // {id, text, authorId, guesses: {playerId: guessedAuthorId}}
        scores: {}, // playerId: score
        roundResults: []
    });

    return roomCode;
}

// Socket.io event handling
io.on('connection', (socket) => {
    console.log('Truth Tales: New client connected:', socket.id);

    // Create a new game room
    socket.on('createRoom', ({ playerName }) => {
        const roomCode = createTruthTalesRoom();
        const gameRoom = truthTalesRooms.get(roomCode);
        
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
        
        console.log(`Truth Tales room created: ${roomCode} by ${playerName}`);
    });

    // Join an existing game room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        
        if (!truthTalesRooms.has(roomCode)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const gameRoom = truthTalesRooms.get(roomCode);
        
        if (gameRoom.gameStarted) {
            socket.emit('error', { message: 'Game already in progress' });
            return;
        }
        
        if (gameRoom.players.length >= 8) {
            socket.emit('error', { message: 'Room is full (max 8 players)' });
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
        
        console.log(`Truth Tales: Player ${playerName} joined room ${roomCode}`);
    });

    // Start the game
    socket.on('startGame', ({ roomCode }) => {
        const gameRoom = truthTalesRooms.get(roomCode);
        
        if (!gameRoom || gameRoom.host !== socket.id) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }
        
        if (gameRoom.players.length < 3) {
            socket.emit('error', { message: 'Need at least 3 players to start' });
            return;
        }
        
        gameRoom.gameStarted = true;
        gameRoom.currentRound = 1;
        gameRoom.phase = GAME_PHASES.STORY_WRITING;
        gameRoom.currentTopic = getRandomTopic();
        
        // Initialize scores
        gameRoom.players.forEach(player => {
            gameRoom.scores[player.id] = 0;
        });
        
        io.to(roomCode).emit('gameStarted', {
            message: `Truth Tales begins! Round 1 of 3`,
            topic: gameRoom.currentTopic,
            phase: GAME_PHASES.STORY_WRITING
        });
        
        console.log(`Truth Tales game started in room ${roomCode}`);
    });

    // Handle story submission
    socket.on('submitStory', ({ roomCode, story }) => {
        const gameRoom = truthTalesRooms.get(roomCode);
        
        if (!gameRoom || gameRoom.phase !== GAME_PHASES.STORY_WRITING) {
            socket.emit('error', { message: 'Cannot submit story at this time' });
            return;
        }
        
        // Add story to collection
        gameRoom.stories.push({
            id: gameRoom.stories.length,
            text: story.trim(),
            authorId: socket.id,
            guesses: {}
        });
        
        socket.emit('storySubmitted');
        
        // Check if all players have submitted
        if (gameRoom.stories.length >= gameRoom.players.length) {
            // Move to guessing phase
            gameRoom.phase = GAME_PHASES.STORY_GUESSING;
            
            // Shuffle stories for guessing
            const shuffledStories = gameRoom.stories
                .map(story => ({ id: story.id, text: story.text }))
                .sort(() => Math.random() - 0.5);
            
            io.to(roomCode).emit('guessingPhase', {
                stories: shuffledStories,
                players: gameRoom.players.map(p => ({ id: p.id, name: p.name }))
            });
        }
    });

    // Handle guesses
    socket.on('submitGuess', ({ roomCode, storyId, guessedAuthorId }) => {
        const gameRoom = truthTalesRooms.get(roomCode);
        
        if (!gameRoom || gameRoom.phase !== GAME_PHASES.STORY_GUESSING) {
            socket.emit('error', { message: 'Cannot submit guess at this time' });
            return;
        }
        
        const story = gameRoom.stories.find(s => s.id === storyId);
        if (story) {
            story.guesses[socket.id] = guessedAuthorId;
        }
        
        socket.emit('guessSubmitted');
        
        // Check if all players have guessed for all stories
        const totalGuessesNeeded = gameRoom.stories.length * gameRoom.players.length;
        const totalGuessesReceived = gameRoom.stories.reduce((total, story) => 
            total + Object.keys(story.guesses).length, 0);
        
        if (totalGuessesReceived >= totalGuessesNeeded) {
            // Calculate scores and show results
            calculateRoundResults(roomCode);
        }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log('Truth Tales: Client disconnected:', socket.id);
        
        for (const [roomCode, gameRoom] of truthTalesRooms.entries()) {
            const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const player = gameRoom.players[playerIndex];
                gameRoom.players.splice(playerIndex, 1);
                
                if (gameRoom.host === socket.id && gameRoom.players.length > 0) {
                    gameRoom.host = gameRoom.players[0].id;
                    gameRoom.players[0].isHost = true;
                }
                
                if (gameRoom.players.length === 0) {
                    truthTalesRooms.delete(roomCode);
                } else {
                    io.to(roomCode).emit('playerLeft', { 
                        playerName: player.name,
                        players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
                    });
                }
            }
        }
    });
});

function calculateRoundResults(roomCode) {
    const gameRoom = truthTalesRooms.get(roomCode);
    
    // Calculate scores for this round
    const roundResults = [];
    
    gameRoom.stories.forEach(story => {
        const author = gameRoom.players.find(p => p.id === story.authorId);
        const correctGuesses = Object.values(story.guesses).filter(guess => guess === story.authorId).length;
        const totalGuesses = Object.keys(story.guesses).length;
        
        // Author gets points for each wrong guess
        gameRoom.scores[story.authorId] += (totalGuesses - correctGuesses);
        
        // Players get points for correct guesses
        Object.entries(story.guesses).forEach(([guesserId, guessedAuthorId]) => {
            if (guessedAuthorId === story.authorId) {
                gameRoom.scores[guesserId] += 2;
            }
        });
        
        roundResults.push({
            story: story.text,
            author: author.name,
            correctGuesses,
            totalGuesses,
            guesses: Object.entries(story.guesses).map(([guesserId, guessedAuthorId]) => {
                const guesser = gameRoom.players.find(p => p.id === guesserId);
                const guessedPlayer = gameRoom.players.find(p => p.id === guessedAuthorId);
                return {
                    guesser: guesser.name,
                    guessedAuthor: guessedPlayer.name,
                    correct: guessedAuthorId === story.authorId
                };
            })
        });
    });
    
    gameRoom.phase = GAME_PHASES.RESULTS;
    
    io.to(roomCode).emit('roundResults', {
        results: roundResults,
        scores: gameRoom.players.map(p => ({
            name: p.name,
            score: gameRoom.scores[p.id]
        })).sort((a, b) => b.score - a.score)
    });
    
    // Check if game is complete
    if (gameRoom.currentRound >= 3) {
        setTimeout(() => {
            endTruthTalesGame(roomCode);
        }, 10000);
    } else {
        // Next round
        setTimeout(() => {
            startNextRound(roomCode);
        }, 10000);
    }
}

function startNextRound(roomCode) {
    const gameRoom = truthTalesRooms.get(roomCode);
    
    gameRoom.currentRound++;
    gameRoom.phase = GAME_PHASES.STORY_WRITING;
    gameRoom.currentTopic = getRandomTopic();
    gameRoom.stories = [];
    
    io.to(roomCode).emit('nextRound', {
        round: gameRoom.currentRound,
        topic: gameRoom.currentTopic,
        phase: GAME_PHASES.STORY_WRITING
    });
}

function endTruthTalesGame(roomCode) {
    const gameRoom = truthTalesRooms.get(roomCode);
    
    const finalScores = gameRoom.players.map(p => ({
        name: p.name,
        score: gameRoom.scores[p.id]
    })).sort((a, b) => b.score - a.score);
    
    io.to(roomCode).emit('gameEnded', {
        winner: finalScores[0],
        finalScores: finalScores
    });
    
    // Reset game
    gameRoom.gameStarted = false;
    gameRoom.currentRound = 0;
    gameRoom.phase = GAME_PHASES.WAITING;
    gameRoom.stories = [];
    gameRoom.scores = {};
}

// Start server on different port than main game
const PORT = process.env.TRUTH_TALES_PORT || 3002;
server.listen(PORT, () => {
    console.log(`🕵️ Truth Tales server running on port ${PORT}`);
    console.log(`🌐 Visit: http://localhost:${PORT}`);
});