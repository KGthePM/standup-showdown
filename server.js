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

// Audience reaction thresholds and types
const AUDIENCE_REACTIONS = {
    CRICKETS: { 
        threshold: 0, 
        name: 'crickets',
        message: '🦗 *crickets chirping*',
        hostLine: "Well... that was... something. Moving on!"
    },
    MILD: { 
        threshold: 0.2, 
        name: 'mild',
        message: '😊 *polite chuckles*',
        hostLine: "Hey, I heard a laugh! Or was that a cough?"
    },
    MEDIUM: { 
        threshold: 0.4, 
        name: 'medium',
        message: '😄 *genuine laughter*',
        hostLine: "Now we're cooking! The audience is warming up!"
    },
    STRONG: { 
        threshold: 0.6, 
        name: 'strong',
        message: '😂 *big laughs and applause*',
        hostLine: "That's what I'm talking about! Comedy gold!"
    },
    STANDING_OVATION: { 
        threshold: 0.8, 
        name: 'ovation',
        message: '🎉 *standing ovation*',
        hostLine: "INCREDIBLE! Someone get this person a Netflix special!"
    }
};

// Comedy host lines
const HOST_LINES = {
    gameStart: [
        "Ladies and gentlemen, welcome to StandUp Showdown! I'm your host, and I've seen funnier things at a DMV, but let's see what you've got!",
        "Welcome comedy legends! Or should I say... comedy leg-ends? Because some of these jokes might not have legs!",
        "It's showtime! Remember, timing is everything in comedy. That's why I'm always late to parties!",
        "Welcome to StandUp Showdown, where dreams come true and egos get bruised!"
    ],
    roundIntros: {
        1: [
            "Time for Setup Battle! Remember, a good setup is like a good relationship - it needs a strong foundation before the punchline hits!",
            "Setup Battle begins! You'll get a punchline, you write the setup. It's like Jeopardy, but funny!",
            "Round 1: Setup Battle! Show us how you get to these punchlines. GPS not included!"
        ],
        2: [
            "Punchline Challenge is up! This is where we separate the comedians from the people who think they're funny at parties!",
            "Time to deliver those punchlines! Remember, it's all about the delivery. Unlike my pizza, which never arrives!",
            "Punchline Challenge! The setup is ready, now stick the landing!"
        ],
        3: [
            "Full Joke Creation - no training wheels! Time to show us if you're Netflix special material or open mic nightmare!",
            "The final round! Write a complete joke. This is your moment to shine... or crash and burn spectacularly!",
            "Full Joke Creation! You've got a topic, now make us laugh! No pressure, but your comedy career depends on it!"
        ]
    },
    betweenSubmissions: [
        "While our comedians are crafting their masterpieces, did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them!",
        "Everyone's typing away! Remember, comedy is 10% inspiration and 90% desperation!",
        "I can feel the creative energy! Or is that just the air conditioning?"
    ],
    votingStart: [
        "Time to vote! Remember, you can't vote for yourself. That's like laughing at your own jokes... which I definitely don't do...",
        "Voting time! Pick your favorite, and try not to play favorites. Unless it's really funny, then absolutely play favorites!",
        "Let's see which jokes land and which ones... well, let's stay positive!"
    ],
    noVotes: [
        "Ouch! Zero votes. But hey, bombing is a rite of passage in comedy! You're basically a pro now!",
        "No votes, but don't worry - even Jerry Seinfeld bombed once. Well, probably more than once.",
        "Zero votes? That's not a failure, that's avant-garde comedy! Very experimental!"
    ],
    winner: [
        "And the winner is {name}! Someone call Netflix, we've got a star!",
        "Congratulations to {name}! You've won the game and my respect, which is worth... well, nothing, but still!",
        "{name} takes the crown! Your prize? The satisfaction of being funnier than your friends!"
    ],
    encouragement: [
        "Great submission! I actually laughed, and my standards are pretty low!",
        "That's the spirit! Keep them coming!",
        "I see what you did there! Comedy genius or happy accident? We'll never know!"
    ]
};

// Helper functions
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function getRandomHostLine(category) {
    const lines = HOST_LINES[category];
    if (Array.isArray(lines)) {
        return lines[Math.floor(Math.random() * lines.length)];
    }
    return lines;
}

function getAudienceReaction(votes, totalPlayers) {
    const votePercentage = votes / (totalPlayers - 1); // -1 because you can't vote for yourself
    
    let reaction = AUDIENCE_REACTIONS.CRICKETS;
    for (const [key, value] of Object.entries(AUDIENCE_REACTIONS)) {
        if (votePercentage >= value.threshold) {
            reaction = value;
        }
    }
    return reaction;
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
        scores: {}, // player scores across all rounds
        achievements: {} // track achievements per player
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

    // Send host introduction for this round
    const hostLine = getRandomHostLine(`roundIntros`)[roundNumber];
    io.to(roomCode).emit('hostSpeaks', {
        line: hostLine,
        type: 'roundIntro'
    });

    // Send round data to all players
    setTimeout(() => {
        gameRoom.players.forEach((player, index) => {
            io.to(player.id).emit('roundStarted', {
                round: roundNumber,
                roundName: ROUND_NAMES[roundNumber],
                roundType: roundType,
                content: content[index],
                timeLimit: TIMER_DURATION
            });
        });
    }, 3000); // Give time for host line to be read

    console.log(`Round ${roundNumber} started in room ${roomCode} with ${gameRoom.players.length} players`);

    // Send encouraging host line midway through
    setTimeout(() => {
        if (gameRoom.roundPhase === 'writing') {
            io.to(roomCode).emit('hostSpeaks', {
                line: getRandomHostLine('betweenSubmissions'),
                type: 'encouragement'
            });
        }
    }, TIMER_DURATION * 500); // Halfway through

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

    // Send host voting introduction
    io.to(roomCode).emit('hostSpeaks', {
        line: getRandomHostLine('votingStart'),
        type: 'voting'
    });

    console.log(`Voting phase started in room ${roomCode} with ${submissions.length} submissions`);

    // Send voting data to all players after host speaks
    setTimeout(() => {
        io.to(roomCode).emit('votingStarted', {
            submissions: submissions.map(s => ({ id: s.id, text: s.text })),
            timeLimit: VOTING_DURATION
        });
    }, 2500);

    // Start voting timer
    gameRoom.roundData.timer = setTimeout(() => {
        console.log(`Voting timer expired for room ${roomCode}, forcing results`);
        if (gameRoom.roundPhase === 'voting') {
            endVotingPhase(roomCode);
        }
    }, (VOTING_DURATION * 1000) + 2500);
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

    // Update player scores and check for achievements
    submissions.forEach(([playerId, submission], index) => {
        const votesReceived = voteCount[index] || 0;
        if (!gameRoom.scores[playerId]) {
            gameRoom.scores[playerId] = 0;
        }
        
        // Base points for votes
        gameRoom.scores[playerId] += votesReceived;
        
        // Bonus points
        if (votesReceived === gameRoom.players.length - 1) {
            gameRoom.scores[playerId] += 2; // Everyone voted for you bonus
            if (!gameRoom.achievements[playerId]) gameRoom.achievements[playerId] = [];
            gameRoom.achievements[playerId].push('CROWD_PLEASER');
        }
        
        if (votesReceived === 0) {
            if (!gameRoom.achievements[playerId]) gameRoom.achievements[playerId] = [];
            gameRoom.achievements[playerId].push('CRICKETS_CLUB');
        }
    });

    // Prepare results with player names
    const results = submissions.map(([playerId, submission], index) => {
        const player = gameRoom.players.find(p => p.id === playerId);
        return {
            playerName: player ? player.name : 'Unknown',
            submission: submission,
            votes: voteCount[index] || 0,
            playerId: playerId
        };
    }).sort((a, b) => b.votes - a.votes);

    // Send audience reactions for top jokes
    results.forEach((result, index) => {
        if (index < 3) { // Top 3 get reactions
            const reaction = getAudienceReaction(result.votes, gameRoom.players.length);
            
            setTimeout(() => {
                io.to(roomCode).emit('audienceReaction', {
                    reaction: reaction,
                    submission: result.submission,
                    playerName: result.playerName,
                    isWinner: index === 0
                });
            }, index * 2000); // Stagger reactions
        }
    });

    // Send host commentary based on results
    const topResult = results[0];
    if (topResult.votes === 0) {
        io.to(roomCode).emit('hostSpeaks', {
            line: getRandomHostLine('noVotes'),
            type: 'results'
        });
    } else if (topResult.votes === gameRoom.players.length - 1) {
        io.to(roomCode).emit('hostSpeaks', {
            line: `Unanimous victory! That joke killed harder than my career in accounting!`,
            type: 'results'
        });
    }

    // Send results after reactions
    setTimeout(() => {
        io.to(roomCode).emit('roundResults', {
            results: results,
            scores: gameRoom.players.map(player => ({
                name: player.name,
                score: gameRoom.scores[player.id] || 0
            })).sort((a, b) => b.score - a.score),
            achievements: gameRoom.achievements
        });
    }, results.length > 0 ? 6000 : 1000);

    // Check if game is complete
    if (gameRoom.currentRound >= 3) {
        // Game over
        setTimeout(() => {
            endGame(roomCode);
        }, 10000);
    } else {
        // Next round
        setTimeout(() => {
            startRound(roomCode, gameRoom.currentRound + 1);
        }, 10000);
    }

    console.log(`Round ${gameRoom.currentRound} ended in room ${roomCode}`);
}

function endGame(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom) return;

    const finalScores = gameRoom.players.map(player => ({
        name: player.name,
        score: gameRoom.scores[player.id] || 0,
        achievements: gameRoom.achievements[player.id] || []
    })).sort((a, b) => b.score - a.score);

    // Send host finale
    const winnerLine = HOST_LINES.winner[Math.floor(Math.random() * HOST_LINES.winner.length)]
        .replace('{name}', finalScores[0].name);
    
    io.to(roomCode).emit('hostSpeaks', {
        line: winnerLine,
        type: 'finale'
    });

    setTimeout(() => {
        io.to(roomCode).emit('gameEnded', {
            winner: finalScores[0],
            finalScores: finalScores
        });
    }, 3000);

    // Reset game state
    gameRoom.gameStarted = false;
    gameRoom.currentRound = 0;
    gameRoom.roundPhase = 'waiting';
    gameRoom.scores = {};
    gameRoom.achievements = {};

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
        
        // Send host welcome
        io.to(roomCode).emit('hostSpeaks', {
            line: getRandomHostLine('gameStart'),
            type: 'welcome'
        });
        
        // Notify all players that game is starting
        setTimeout(() => {
            io.to(roomCode).emit('gameStarting', {
                message: `Game starting with ${gameRoom.players.length} players! Everyone participates - even the host!`,
                totalPlayers: gameRoom.players.length
            });
        }, 3000);
        
        // Start first round after host intro
        setTimeout(() => {
            startRound(roomCode, ROUNDS.SETUP_BATTLE);
        }, 5000);
        
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