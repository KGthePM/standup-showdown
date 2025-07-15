const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

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
    "Awkward crush confession",
    "Time you got caught lying",
    "Worst haircut experience",
    "Embarrassing medical appointment",
    "Public transportation disaster",
    "Failed attempt to be cool",
    "Embarrassing autocorrect fail",
    "Time you walked into the wrong place",
    "Worst dance move attempt",
    "Embarrassing food incident",
    "Time you forgot someone's name",
    "Epic wardrobe malfunction",
    "Worst first impression you made",
    "Time you fell in public",
    "Embarrassing thing your parents did",
    "Most awkward small talk moment"
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

    const room = {
        players: [],
        host: null,
        gameStarted: false,
        currentRound: 0,
        phase: GAME_PHASES.WAITING,
        currentTopic: null,
        stories: [], // {id, text, authorId, guesses: {playerId: guessedAuthorId}}
        scores: {}, // playerId: score
        roundResults: [],
        createdAt: new Date()
    };

    truthTalesRooms.set(roomCode, room);
    console.log(`Truth Tales room created: ${roomCode}`);
    return roomCode;
}

function cleanupOldRooms() {
    const now = new Date();
    const CLEANUP_TIME = 2 * 60 * 60 * 1000; // 2 hours

    for (const [roomCode, room] of truthTalesRooms.entries()) {
        if (now - room.createdAt > CLEANUP_TIME) {
            console.log(`Cleaning up old room: ${roomCode}`);
            truthTalesRooms.delete(roomCode);
        }
    }
}

// Clean up old rooms every hour
setInterval(cleanupOldRooms, 60 * 60 * 1000);

// Socket.io event handling
io.on('connection', (socket) => {
    console.log('Truth Tales: New client connected:', socket.id);

    // Create a new game room
    socket.on('createRoom', ({ playerName, gameType }) => {
        try {
            if (!playerName || playerName.trim().length < 2) {
                socket.emit('error', { message: 'Invalid player name' });
                return;
            }

            const roomCode = createTruthTalesRoom();
            const gameRoom = truthTalesRooms.get(roomCode);
            
            gameRoom.host = socket.id;
            gameRoom.players.push({
                id: socket.id,
                name: playerName.trim(),
                isHost: true,
                score: 0
            });
            
            socket.join(roomCode);
            
            socket.emit('roomCreated', { 
                roomCode, 
                isHost: true,
                gameType: 'truth_tales',
                players: gameRoom.players.map(p => ({ 
                    name: p.name, 
                    score: p.score, 
                    isHost: p.isHost 
                }))
            });
            
            console.log(`Truth Tales room ${roomCode} created by ${playerName}`);
        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('error', { message: 'Failed to create room' });
        }
    });

    // Join an existing game room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        try {
            roomCode = roomCode.toUpperCase().trim();
            
            if (!roomCode || roomCode.length !== 4) {
                socket.emit('error', { message: 'Invalid room code' });
                return;
            }

            if (!playerName || playerName.trim().length < 2) {
                socket.emit('error', { message: 'Invalid player name' });
                return;
            }
            
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
            
            if (gameRoom.players.some(p => p.name.toLowerCase() === playerName.trim().toLowerCase())) {
                socket.emit('error', { message: 'Name already taken in this room' });
                return;
            }
            
            gameRoom.players.push({
                id: socket.id,
                name: playerName.trim(),
                isHost: false,
                score: 0
            });
            
            socket.join(roomCode);
            
            socket.emit('roomJoined', { 
                roomCode,
                isHost: false,
                gameType: 'truth_tales',
                players: gameRoom.players.map(p => ({ 
                    name: p.name, 
                    score: p.score, 
                    isHost: p.isHost 
                }))
            });
            
            // Notify other players
            socket.to(roomCode).emit('playerJoined', { 
                playerName: playerName.trim(),
                players: gameRoom.players.map(p => ({ 
                    name: p.name, 
                    score: p.score, 
                    isHost: p.isHost 
                }))
            });
            
            console.log(`Player ${playerName} joined Truth Tales room ${roomCode}`);
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Start the game
    socket.on('startGame', ({ roomCode }) => {
        try {
            const gameRoom = truthTalesRooms.get(roomCode);
            
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
            
            if (gameRoom.gameStarted) {
                socket.emit('error', { message: 'Game already started' });
                return;
            }
            
            // Initialize game state
            gameRoom.gameStarted = true;
            gameRoom.currentRound = 1;
            gameRoom.phase = GAME_PHASES.STORY_WRITING;
            gameRoom.currentTopic = getRandomTopic();
            gameRoom.stories = [];
            
            // Initialize scores
            gameRoom.players.forEach(player => {
                gameRoom.scores[player.id] = 0;
            });
            
            io.to(roomCode).emit('gameStarted', {
                message: `Truth Tales begins! Round 1 of 3 - Share your embarrassing stories!`,
                topic: gameRoom.currentTopic,
                phase: GAME_PHASES.STORY_WRITING
            });
            
            console.log(`Truth Tales game started in room ${roomCode} with ${gameRoom.players.length} players`);
        } catch (error) {
            console.error('Error starting game:', error);
            socket.emit('error', { message: 'Failed to start game' });
        }
    });

    // Handle story submission
    socket.on('submitStory', ({ roomCode, story }) => {
        try {
            const gameRoom = truthTalesRooms.get(roomCode);
            
            if (!gameRoom) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            if (gameRoom.phase !== GAME_PHASES.STORY_WRITING) {
                socket.emit('error', { message: 'Cannot submit story at this time' });
                return;
            }

            if (!story || story.trim().length < 10) {
                socket.emit('error', { message: 'Story must be at least 10 characters long' });
                return;
            }

            // Check if player already submitted
            if (gameRoom.stories.some(s => s.authorId === socket.id)) {
                socket.emit('error', { message: 'You have already submitted a story' });
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
            
            console.log(`Story submitted in room ${roomCode}: ${gameRoom.stories.length}/${gameRoom.players.length}`);
            
            // Check if all players have submitted
            if (gameRoom.stories.length >= gameRoom.players.length) {
                startGuessingPhase(roomCode);
            }
        } catch (error) {
            console.error('Error submitting story:', error);
            socket.emit('error', { message: 'Failed to submit story' });
        }
    });

    // FIXED: Handle guesses with improved validation
    socket.on('submitGuess', ({ roomCode, storyId, guessedAuthorId }) => {
        try {
            const gameRoom = truthTalesRooms.get(roomCode);
            
            if (!gameRoom) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            if (gameRoom.phase !== GAME_PHASES.STORY_GUESSING) {
                socket.emit('error', { message: 'Cannot submit guess at this time' });
                return;
            }
            
            const story = gameRoom.stories.find(s => s.id === storyId);
            if (!story) {
                socket.emit('error', { message: 'Story not found' });
                return;
            }

            // CRITICAL FIX: Don't allow guessing your own story
            if (story.authorId === socket.id) {
                console.log(`Player ${socket.id} tried to guess their own story ${storyId} - blocking`);
                socket.emit('error', { message: 'Cannot guess your own story' });
                return;
            }

            // Validate guessed author exists
            if (!gameRoom.players.some(p => p.id === guessedAuthorId)) {
                socket.emit('error', { message: 'Invalid player selection' });
                return;
            }

            // Store the guess
            story.guesses[socket.id] = guessedAuthorId;
            socket.emit('guessSubmitted');
            
            console.log(`Guess submitted in room ${roomCode}: Player ${socket.id} guessed story ${storyId} was written by ${guessedAuthorId}`);
            
            // IMPROVED: Check if all valid guesses are submitted
            checkAllGuessesSubmitted(roomCode);
            
        } catch (error) {
            console.error('Error submitting guess:', error);
            socket.emit('error', { message: 'Failed to submit guess' });
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
                
                // Handle host reassignment
                if (gameRoom.host === socket.id && gameRoom.players.length > 0) {
                    gameRoom.host = gameRoom.players[0].id;
                    gameRoom.players[0].isHost = true;
                    
                    io.to(roomCode).emit('hostChanged', {
                        newHost: gameRoom.players[0].name,
                        players: gameRoom.players.map(p => ({ 
                            name: p.name, 
                            score: p.score, 
                            isHost: p.isHost 
                        }))
                    });
                }
                
                if (gameRoom.players.length === 0) {
                    console.log(`Deleting empty room: ${roomCode}`);
                    truthTalesRooms.delete(roomCode);
                } else {
                    io.to(roomCode).emit('playerLeft', { 
                        playerName: player.name,
                        players: gameRoom.players.map(p => ({ 
                            name: p.name, 
                            score: p.score, 
                            isHost: p.isHost 
                        }))
                    });
                }
                
                console.log(`Player ${player.name} left Truth Tales room ${roomCode}`);
                break;
            }
        }
    });
});

function startGuessingPhase(roomCode) {
    try {
        const gameRoom = truthTalesRooms.get(roomCode);
        if (!gameRoom) return;

        // Move to guessing phase
        gameRoom.phase = GAME_PHASES.STORY_GUESSING;
        
        console.log(`🎯 Starting guessing phase for room ${roomCode}`);
        console.log(`📝 Total stories:`, gameRoom.stories.length);
        
        // Send personalized story lists to each player (excluding their own story)
        gameRoom.players.forEach(player => {
            console.log(`👤 Preparing stories for player ${player.name} (${player.id})`);
            
            // Filter out this player's own story
            const otherPlayersStories = gameRoom.stories
                .filter(story => story.authorId !== player.id)
                .map(story => ({ 
                    id: story.id, 
                    text: story.text // 🔒 authorId omitted
                }))
                .sort(() => Math.random() - 0.5); // Shuffle
            
            // Provide all players (including self) as dropdown options
            const allPlayers = gameRoom.players.map(p => ({ 
                id: p.id, 
                name: p.name 
            }));
            
            console.log(`📤 Sending to ${player.name}: ${otherPlayersStories.length} stories to guess`);
            
            io.to(player.id).emit('guessingPhase', {
                stories: otherPlayersStories,
                players: allPlayers
            });
        });

        console.log(`✅ Guessing phase started in room ${roomCode}`);
    } catch (error) {
        console.error('❌ Error starting guessing phase:', error);
    }
}


// CRITICAL FIX: Improved guess checking logic
function checkAllGuessesSubmitted(roomCode) {
    try {
        const gameRoom = truthTalesRooms.get(roomCode);
        if (!gameRoom) return;

        // Calculate how many guesses each player should make
        // Each player should guess on all stories EXCEPT their own
        let expectedTotalGuesses = 0;
        let actualTotalGuesses = 0;
        
        for (const player of gameRoom.players) {
            for (const story of gameRoom.stories) {
                // Players can only guess stories they didn't write
                if (story.authorId !== player.id) {
                    expectedTotalGuesses++;
                    
                    // Check if this player has guessed this story
                    if (story.guesses[player.id]) {
                        actualTotalGuesses++;
                    }
                }
            }
        }
        
        console.log(`🔍 Room ${roomCode} guess progress: ${actualTotalGuesses}/${expectedTotalGuesses} valid guesses submitted`);
        
        // Detailed logging for debugging
        gameRoom.players.forEach(player => {
            const playerGuesses = [];
            gameRoom.stories.forEach(story => {
                if (story.authorId !== player.id) {
                    const hasGuessed = story.guesses[player.id] ? '✅' : '❌';
                    playerGuesses.push(`Story ${story.id}: ${hasGuessed}`);
                }
            });
            console.log(`Player ${player.name} (${player.id}): ${playerGuesses.join(', ')}`);
        });
        
        // If everyone has submitted all their valid guesses, calculate results
        if (actualTotalGuesses >= expectedTotalGuesses && expectedTotalGuesses > 0) {
            console.log(`🎉 ALL VALID GUESSES SUBMITTED in room ${roomCode}! Calculating results...`);
            calculateRoundResults(roomCode);
        } else {
            console.log(`⏳ Still waiting for ${expectedTotalGuesses - actualTotalGuesses} more guesses in room ${roomCode}`);
        }
    } catch (error) {
        console.error('Error checking guesses:', error);
    }
}

function calculateRoundResults(roomCode) {
    try {
        const gameRoom = truthTalesRooms.get(roomCode);
        if (!gameRoom) return;
        
        const roundResults = [];
        
        gameRoom.stories.forEach(story => {
            const author = gameRoom.players.find(p => p.id === story.authorId);
            if (!author) return;

            const allGuesses = Object.entries(story.guesses);
            const correctGuesses = allGuesses.filter(([guesserId, guessedAuthorId]) => 
                guessedAuthorId === story.authorId
            ).length;
            const totalGuesses = allGuesses.length;
            
            // IMPROVED SCORING SYSTEM
            // Author gets points for each wrong guess (misdirection)
            const wrongGuesses = totalGuesses - correctGuesses;
            gameRoom.scores[story.authorId] = (gameRoom.scores[story.authorId] || 0) + wrongGuesses;
            
            // Players get points for correct guesses
            allGuesses.forEach(([guesserId, guessedAuthorId]) => {
                if (guessedAuthorId === story.authorId) {
                    gameRoom.scores[guesserId] = (gameRoom.scores[guesserId] || 0) + 2; // 2 points for correct guess
                }
            });
            
            // Perfect misdirection bonus (fooled everyone)
            if (correctGuesses === 0 && totalGuesses > 0) {
                gameRoom.scores[story.authorId] = (gameRoom.scores[story.authorId] || 0) + 3; // Bonus for fooling everyone
            }
            
            roundResults.push({
                story: story.text,
                author: author.name,
                correctGuesses,
                totalGuesses,
                guesses: allGuesses.map(([guesserId, guessedAuthorId]) => {
                    const guesser = gameRoom.players.find(p => p.id === guesserId);
                    const guessedPlayer = gameRoom.players.find(p => p.id === guessedAuthorId);
                    return {
                        guesser: guesser ? guesser.name : 'Unknown',
                        guessedAuthor: guessedPlayer ? guessedPlayer.name : 'Unknown',
                        correct: guessedAuthorId === story.authorId
                    };
                })
            });
        });
        
        gameRoom.phase = GAME_PHASES.RESULTS;
        
        const sortedScores = gameRoom.players.map(p => ({
            name: p.name,
            score: gameRoom.scores[p.id] || 0
        })).sort((a, b) => b.score - a.score);
        
        io.to(roomCode).emit('roundResults', {
            results: roundResults,
            scores: sortedScores
        });
        
        console.log(`Round ${gameRoom.currentRound} results calculated for room ${roomCode}`);
        
        // Check if game is complete
        if (gameRoom.currentRound >= 3) {
            setTimeout(() => {
                endTruthTalesGame(roomCode);
            }, 10000); // 10 second delay before ending
        } else {
            setTimeout(() => {
                startNextRound(roomCode);
            }, 10000); // 10 second delay before next round
        }
    } catch (error) {
        console.error('Error calculating results:', error);
    }
}

function startNextRound(roomCode) {
    try {
        const gameRoom = truthTalesRooms.get(roomCode);
        if (!gameRoom) return;
        
        gameRoom.currentRound++;
        gameRoom.phase = GAME_PHASES.STORY_WRITING;
        gameRoom.currentTopic = getRandomTopic();
        gameRoom.stories = []; // Clear stories for new round
        
        io.to(roomCode).emit('nextRound', {
            round: gameRoom.currentRound,
            topic: gameRoom.currentTopic,
            phase: GAME_PHASES.STORY_WRITING
        });
        
        console.log(`Round ${gameRoom.currentRound} started in room ${roomCode}`);
    } catch (error) {
        console.error('Error starting next round:', error);
    }
}

function endTruthTalesGame(roomCode) {
    try {
        const gameRoom = truthTalesRooms.get(roomCode);
        if (!gameRoom) return;
        
        const finalScores = gameRoom.players.map(p => ({
            name: p.name,
            score: gameRoom.scores[p.id] || 0
        })).sort((a, b) => b.score - a.score);
        
        io.to(roomCode).emit('gameEnded', {
            winner: finalScores[0],
            finalScores: finalScores
        });
        
        // Reset game state for potential replay
        gameRoom.gameStarted = false;
        gameRoom.currentRound = 0;
        gameRoom.phase = GAME_PHASES.WAITING;
        gameRoom.stories = [];
        gameRoom.scores = {};
        
        console.log(`Truth Tales game ended in room ${roomCode}. Winner: ${finalScores[0].name}`);
    } catch (error) {
        console.error('Error ending game:', error);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        activeRooms: truthTalesRooms.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.TRUTH_TALES_PORT || 3002;
server.listen(PORT, () => {
    console.log(`🕵️ Truth Tales server running on port ${PORT}`);
    console.log(`🌐 Visit: http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});