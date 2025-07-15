const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { getRandomContent, getUniqueContentForPlayers } = require('./content');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ========================================
// ENHANCED STATIC FILE SERVING & ROUTES
// ========================================

// Custom static file middleware with better error handling
function createStaticMiddleware(root, options = {}) {
    return express.static(root, {
        ...options,
        // Disable range requests to prevent Range Not Satisfiable errors
        acceptRanges: false,
        // Set proper headers
        setHeaders: (res, path, stat) => {
            res.set('Cache-Control', 'public, max-age=0');
            res.set('Accept-Ranges', 'none');
        },
        // Handle errors gracefully
        fallthrough: true
    });
}

// Serve static files with enhanced error handling
app.use('/joke-factory', createStaticMiddleware(path.join(__dirname, 'public')));
app.use('/truth-tales', createStaticMiddleware(path.join(__dirname, 'games/truth-tales/public')));

// Main hub route
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send(`
                <h1>StandUp Showdown - Game Hub Not Found</h1>
                <p>Main index.html file not found. Please check your file structure.</p>
                <p><a href="/joke-factory">Try Joke Factory directly</a></p>
                <p><a href="/truth-tales">Try Truth Tales directly</a></p>
            `);
        }
    } catch (error) {
        console.error('Error serving main route:', error);
        res.status(500).send('Internal server error');
    }
});

// Joke Factory route
app.get('/joke-factory', (req, res) => {
    try {
        const jokeFactoryPath = path.join(__dirname, 'public', 'index.html');
        if (fs.existsSync(jokeFactoryPath)) {
            res.sendFile(jokeFactoryPath);
        } else {
            res.status(404).send(`
                <h1>Joke Factory Not Found</h1>
                <p>Joke Factory index.html not found at: ${jokeFactoryPath}</p>
                <p><a href="/">Back to Hub</a></p>
            `);
        }
    } catch (error) {
        console.error('Error serving Joke Factory:', error);
        res.status(500).send('Internal server error');
    }
});

// Truth Tales route
app.get('/truth-tales', (req, res) => {
    try {
        const truthTalesPath = path.join(__dirname, 'games/truth-tales/public', 'index.html');
        if (fs.existsSync(truthTalesPath)) {
            res.sendFile(truthTalesPath);
        } else {
            res.status(404).send(`
                <h1>Truth Tales Not Found</h1>
                <p>Truth Tales index.html not found at: ${truthTalesPath}</p>
                <p><a href="/">Back to Hub</a></p>
            `);
        }
    } catch (error) {
        console.error('Error serving Truth Tales:', error);
        res.status(500).send('Internal server error');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        games: ['joke-factory', 'truth-tales'],
        activeRooms: gameRooms.size
    });
});

// Global error handler for static files
app.use((err, req, res, next) => {
    if (err.code === 'ENOENT') {
        console.warn(`File not found: ${req.url}`);
        res.status(404).send('File not found');
    } else if (err.status === 416 || err.message.includes('Range Not Satisfiable')) {
        console.warn(`Range error for: ${req.url}`);
        res.status(200).send(''); // Send empty response instead of range error
    } else {
        console.error('Static file error:', err);
        res.status(500).send('Internal server error');
    }
});

// ========================================
// GAME DATA STORAGE
// ========================================

// Unified game rooms storage - both games use the same Map with game type identification
const gameRooms = new Map();

// Game type constants
const GAME_TYPES = {
    JOKE_FACTORY: 'joke_factory',
    TRUTH_TALES: 'truth_tales'
};

// ========================================
// JOKE FACTORY GAME LOGIC
// ========================================

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

// Comedy host lines for Joke Factory
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

// ========================================
// TRUTH TALES GAME LOGIC
// ========================================

const TRUTH_GAME_PHASES = {
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

// ========================================
// SHARED HELPER FUNCTIONS
// ========================================

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

function getRandomTopic() {
    return STORY_TOPICS[Math.floor(Math.random() * STORY_TOPICS.length)];
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

// ========================================
// UNIFIED ROOM CREATION
// ========================================

function createGameRoom(gameType) {
    let roomCode;
    // Ensure unique room code across all games
    do {
        roomCode = generateRoomCode();
    } while (gameRooms.has(roomCode));

    // Create room structure based on game type
    if (gameType === GAME_TYPES.JOKE_FACTORY) {
        gameRooms.set(roomCode, {
            gameType: GAME_TYPES.JOKE_FACTORY,
            players: [],
            host: null,
            gameStarted: false,
            currentRound: 0,
            roundPhase: 'waiting',
            roundData: {
                content: [],
                submissions: {},
                votes: {},
                timer: null
            },
            scores: {},
            achievements: {}
        });
    } else if (gameType === GAME_TYPES.TRUTH_TALES) {
        gameRooms.set(roomCode, {
            gameType: GAME_TYPES.TRUTH_TALES,
            players: [],
            host: null,
            gameStarted: false,
            currentRound: 0,
            phase: TRUTH_GAME_PHASES.WAITING,
            currentTopic: null,
            stories: [],
            scores: {},
            roundResults: []
        });
    }

    return roomCode;
}

// ========================================
// JOKE FACTORY GAME FUNCTIONS
// ========================================

function startJokeFactoryRound(roomCode, roundNumber) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom || gameRoom.gameType !== GAME_TYPES.JOKE_FACTORY) return;

    gameRoom.currentRound = roundNumber;
    gameRoom.roundPhase = 'writing';
    gameRoom.roundData.submissions = {};
    gameRoom.roundData.votes = {};
    
    if (gameRoom.roundData.timer) {
        clearTimeout(gameRoom.roundData.timer);
        gameRoom.roundData.timer = null;
    }

    let content = [];
    let roundType = '';

    try {
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
    } catch (error) {
        console.error('Error getting content for round:', error);
        // Fallback content
        content = Array(gameRoom.players.length).fill(`Fallback content for round ${roundNumber}`);
        roundType = 'topics';
    }

    gameRoom.roundData.content = content;

    const hostLine = getRandomHostLine(`roundIntros`)[roundNumber];
    io.to(roomCode).emit('hostSpeaks', {
        line: hostLine,
        type: 'roundIntro'
    });

    setTimeout(() => {
        gameRoom.players.forEach((player, index) => {
            io.to(player.id).emit('roundStarted', {
                round: roundNumber,
                roundName: ROUND_NAMES[roundNumber],
                roundType: roundType,
                content: content[index] || `Round ${roundNumber} content`,
                timeLimit: TIMER_DURATION
            });
        });
    }, 3000);

    setTimeout(() => {
        if (gameRoom.roundPhase === 'writing') {
            io.to(roomCode).emit('hostSpeaks', {
                line: getRandomHostLine('betweenSubmissions'),
                type: 'encouragement'
            });
        }
    }, TIMER_DURATION * 500);

    gameRoom.roundData.timer = setTimeout(() => {
        if (gameRoom.roundPhase === 'writing') {
            startJokeFactoryVoting(roomCode);
        }
    }, TIMER_DURATION * 1000);
}

function startJokeFactoryVoting(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom || gameRoom.gameType !== GAME_TYPES.JOKE_FACTORY) return;

    if (gameRoom.roundData.timer) {
        clearTimeout(gameRoom.roundData.timer);
        gameRoom.roundData.timer = null;
    }

    gameRoom.roundPhase = 'voting';

    const submissions = Object.entries(gameRoom.roundData.submissions).map(([playerId, submission], index) => ({
        id: index,
        text: submission,
        playerId: playerId
    }));

    io.to(roomCode).emit('hostSpeaks', {
        line: getRandomHostLine('votingStart'),
        type: 'voting'
    });

    setTimeout(() => {
        io.to(roomCode).emit('votingStarted', {
            submissions: submissions.map(s => ({ id: s.id, text: s.text })),
            timeLimit: VOTING_DURATION
        });
    }, 2500);

    gameRoom.roundData.timer = setTimeout(() => {
        if (gameRoom.roundPhase === 'voting') {
            endJokeFactoryVoting(roomCode);
        }
    }, (VOTING_DURATION * 1000) + 2500);
}

function endJokeFactoryVoting(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom || gameRoom.gameType !== GAME_TYPES.JOKE_FACTORY) return;

    gameRoom.roundPhase = 'results';

    const votes = gameRoom.roundData.votes;
    const submissions = Object.entries(gameRoom.roundData.submissions);
    
    const voteCount = {};
    Object.values(votes).forEach(votedSubmissionId => {
        voteCount[votedSubmissionId] = (voteCount[votedSubmissionId] || 0) + 1;
    });

    submissions.forEach(([playerId, submission], index) => {
        const votesReceived = voteCount[index] || 0;
        if (!gameRoom.scores[playerId]) {
            gameRoom.scores[playerId] = 0;
        }
        
        gameRoom.scores[playerId] += votesReceived;
        
        if (votesReceived === gameRoom.players.length - 1) {
            gameRoom.scores[playerId] += 2;
            if (!gameRoom.achievements[playerId]) gameRoom.achievements[playerId] = [];
            gameRoom.achievements[playerId].push('CROWD_PLEASER');
        }
        
        if (votesReceived === 0) {
            if (!gameRoom.achievements[playerId]) gameRoom.achievements[playerId] = [];
            gameRoom.achievements[playerId].push('CRICKETS_CLUB');
        }
    });

    const results = submissions.map(([playerId, submission], index) => {
        const player = gameRoom.players.find(p => p.id === playerId);
        return {
            playerName: player ? player.name : 'Unknown',
            submission: submission,
            votes: voteCount[index] || 0,
            playerId: playerId
        };
    }).sort((a, b) => b.votes - a.votes);

    results.forEach((result, index) => {
        if (index < 3) {
            const reaction = getAudienceReaction(result.votes, gameRoom.players.length);
            
            setTimeout(() => {
                io.to(roomCode).emit('audienceReaction', {
                    reaction: reaction,
                    submission: result.submission,
                    playerName: result.playerName,
                    isWinner: index === 0
                });
            }, index * 2000);
        }
    });

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

    if (gameRoom.currentRound >= 3) {
        setTimeout(() => {
            endJokeFactoryGame(roomCode);
        }, 10000);
    } else {
        setTimeout(() => {
            startJokeFactoryRound(roomCode, gameRoom.currentRound + 1);
        }, 10000);
    }
}

function endJokeFactoryGame(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom || gameRoom.gameType !== GAME_TYPES.JOKE_FACTORY) return;

    const finalScores = gameRoom.players.map(player => ({
        name: player.name,
        score: gameRoom.scores[player.id] || 0,
        achievements: gameRoom.achievements[player.id] || []
    })).sort((a, b) => b.score - a.score);

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
}

// ========================================
// TRUTH TALES GAME FUNCTIONS
// ========================================

function calculateTruthTalesResults(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom || gameRoom.gameType !== GAME_TYPES.TRUTH_TALES) return;
    
    const roundResults = [];
    
    gameRoom.stories.forEach(story => {
        const author = gameRoom.players.find(p => p.id === story.authorId);
        const correctGuesses = Object.values(story.guesses).filter(guess => guess === story.authorId).length;
        const totalGuesses = Object.keys(story.guesses).length;
        
        gameRoom.scores[story.authorId] += (totalGuesses - correctGuesses);
        
        Object.entries(story.guesses).forEach(([guesserId, guessedAuthorId]) => {
            if (guessedAuthorId === story.authorId) {
                gameRoom.scores[guesserId] += 2;
            }
        });
        
        roundResults.push({
            story: story.text,
            author: author ? author.name : 'Unknown',
            correctGuesses,
            totalGuesses,
            guesses: Object.entries(story.guesses).map(([guesserId, guessedAuthorId]) => {
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
    
    gameRoom.phase = TRUTH_GAME_PHASES.RESULTS;
    
    io.to(roomCode).emit('roundResults', {
        results: roundResults,
        scores: gameRoom.players.map(p => ({
            name: p.name,
            score: gameRoom.scores[p.id] || 0
        })).sort((a, b) => b.score - a.score)
    });
    
    if (gameRoom.currentRound >= 3) {
        setTimeout(() => {
            endTruthTalesGame(roomCode);
        }, 10000);
    } else {
        setTimeout(() => {
            startTruthTalesNextRound(roomCode);
        }, 10000);
    }
}

function startTruthTalesNextRound(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom || gameRoom.gameType !== GAME_TYPES.TRUTH_TALES) return;
    
    gameRoom.currentRound++;
    gameRoom.phase = TRUTH_GAME_PHASES.STORY_WRITING;
    gameRoom.currentTopic = getRandomTopic();
    gameRoom.stories = [];
    
    io.to(roomCode).emit('nextRound', {
        round: gameRoom.currentRound,
        topic: gameRoom.currentTopic,
        phase: TRUTH_GAME_PHASES.STORY_WRITING
    });
}

function endTruthTalesGame(roomCode) {
    const gameRoom = gameRooms.get(roomCode);
    if (!gameRoom || gameRoom.gameType !== GAME_TYPES.TRUTH_TALES) return;
    
    const finalScores = gameRoom.players.map(p => ({
        name: p.name,
        score: gameRoom.scores[p.id] || 0
    })).sort((a, b) => b.score - a.score);
    
    io.to(roomCode).emit('gameEnded', {
        winner: finalScores[0],
        finalScores: finalScores
    });
    
    // Reset game
    gameRoom.gameStarted = false;
    gameRoom.currentRound = 0;
    gameRoom.phase = TRUTH_GAME_PHASES.WAITING;
    gameRoom.stories = [];
    gameRoom.scores = {};
}

// ========================================
// ENHANCED SOCKET.IO EVENT HANDLING WITH ERROR HANDLING
// ========================================

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Enhanced error handling for socket events
    const handleSocketError = (eventName, error) => {
        console.error(`Socket error in ${eventName}:`, error);
        socket.emit('error', { message: `Server error in ${eventName}` });
    };

    // Create room - now with game type specification
    socket.on('createRoom', ({ playerName, gameType }) => {
        try {
            const actualGameType = gameType || GAME_TYPES.JOKE_FACTORY;
            
            const roomCode = createGameRoom(actualGameType);
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
                gameType: actualGameType,
                players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
            });
            
            console.log(`${actualGameType} room created: ${roomCode} by ${playerName}`);
        } catch (error) {
            handleSocketError('createRoom', error);
        }
    });

    // Join room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        try {
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
            
            const maxPlayers = gameRoom.gameType === GAME_TYPES.JOKE_FACTORY ? 6 : 8;
            if (gameRoom.players.length >= maxPlayers) {
                socket.emit('error', { message: `Room is full (max ${maxPlayers} players)` });
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
                gameType: gameRoom.gameType,
                players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
            });
            
            io.to(roomCode).emit('playerJoined', { 
                players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
            });
            
            console.log(`Player ${playerName} joined ${gameRoom.gameType} room ${roomCode}`);
        } catch (error) {
            handleSocketError('joinRoom', error);
        }
    });

    // Start game - unified for both game types
    socket.on('startGame', ({ roomCode }) => {
        try {
            const gameRoom = gameRooms.get(roomCode);
            
            if (!gameRoom || gameRoom.host !== socket.id) {
                socket.emit('error', { message: 'Only the host can start the game' });
                return;
            }
            
            if (gameRoom.players.length < 3) {
                socket.emit('error', { message: 'Need at least 3 players to start' });
                return;
            }
            
            gameRoom.gameStarted = true;
            
            // Initialize scores
            gameRoom.players.forEach(player => {
                gameRoom.scores[player.id] = 0;
            });
            
            if (gameRoom.gameType === GAME_TYPES.JOKE_FACTORY) {
                // Start Joke Factory game
                io.to(roomCode).emit('hostSpeaks', {
                    line: getRandomHostLine('gameStart'),
                    type: 'welcome'
                });
                
                setTimeout(() => {
                    io.to(roomCode).emit('gameStarting', {
                        message: `Game starting with ${gameRoom.players.length} players! Everyone participates - even the host!`,
                        totalPlayers: gameRoom.players.length
                    });
                }, 3000);
                
                setTimeout(() => {
                    startJokeFactoryRound(roomCode, ROUNDS.SETUP_BATTLE);
                }, 5000);
                
            } else if (gameRoom.gameType === GAME_TYPES.TRUTH_TALES) {
                // Start Truth Tales game
                gameRoom.currentRound = 1;
                gameRoom.phase = TRUTH_GAME_PHASES.STORY_WRITING;
                gameRoom.currentTopic = getRandomTopic();
                
                io.to(roomCode).emit('gameStarted', {
                    message: `Truth Tales begins! Round 1 of 3`,
                    topic: gameRoom.currentTopic,
                    phase: TRUTH_GAME_PHASES.STORY_WRITING
                });
            }
            
            console.log(`${gameRoom.gameType} game started in room ${roomCode}`);
        } catch (error) {
            handleSocketError('startGame', error);
        }
    });

    // Handle submissions - route to appropriate game logic
    socket.on('submitAnswer', ({ roomCode, answer }) => {
        try {
            const gameRoom = gameRooms.get(roomCode);
            
            if (!gameRoom) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            if (gameRoom.gameType === GAME_TYPES.JOKE_FACTORY) {
                if (gameRoom.roundPhase !== 'writing') {
                    socket.emit('error', { message: 'Cannot submit at this time' });
                    return;
                }
                
                gameRoom.roundData.submissions[socket.id] = answer.trim();
                
                const submissionCount = Object.keys(gameRoom.roundData.submissions).length;
                const totalPlayers = gameRoom.players.length;
                
                socket.emit('submissionReceived');
                
                io.to(roomCode).emit('submissionUpdate', {
                    submitted: submissionCount,
                    total: totalPlayers
                });
                
                if (submissionCount >= totalPlayers) {
                    if (gameRoom.roundData.timer) {
                        clearTimeout(gameRoom.roundData.timer);
                        gameRoom.roundData.timer = null;
                    }
                    startJokeFactoryVoting(roomCode);
                }
            }
        } catch (error) {
            handleSocketError('submitAnswer', error);
        }
    });

    // Handle Truth Tales story submission
    socket.on('submitStory', ({ roomCode, story }) => {
        try {
            const gameRoom = gameRooms.get(roomCode);
            
            if (!gameRoom || gameRoom.gameType !== GAME_TYPES.TRUTH_TALES) {
                socket.emit('error', { message: 'Invalid room or game type' });
                return;
            }
            
            if (gameRoom.phase !== TRUTH_GAME_PHASES.STORY_WRITING) {
                socket.emit('error', { message: 'Cannot submit story at this time' });
                return;
            }
            
            gameRoom.stories.push({
                id: gameRoom.stories.length,
                text: story.trim(),
                authorId: socket.id,
                guesses: {}
            });
            
            socket.emit('storySubmitted');
            
            if (gameRoom.stories.length >= gameRoom.players.length) {
                gameRoom.phase = TRUTH_GAME_PHASES.STORY_GUESSING;
                
                const shuffledStories = gameRoom.stories
                    .map(story => ({ id: story.id, text: story.text }))
                    .sort(() => Math.random() - 0.5);
                
                io.to(roomCode).emit('guessingPhase', {
                    stories: shuffledStories,
                    players: gameRoom.players.map(p => ({ id: p.id, name: p.name }))
                });
            }
        } catch (error) {
            handleSocketError('submitStory', error);
        }
    });

    // Handle voting for Joke Factory
    socket.on('submitVote', ({ roomCode, submissionId }) => {
        try {
            const gameRoom = gameRooms.get(roomCode);
            
            if (!gameRoom || gameRoom.gameType !== GAME_TYPES.JOKE_FACTORY) {
                socket.emit('error', { message: 'Invalid room or game type' });
                return;
            }
            
            if (gameRoom.roundPhase !== 'voting') {
                socket.emit('error', { message: 'Cannot vote at this time' });
                return;
            }
            
            gameRoom.roundData.votes[socket.id] = submissionId;
            
            const voteCount = Object.keys(gameRoom.roundData.votes).length;
            const totalPlayers = gameRoom.players.length;
            
            socket.emit('voteReceived');
            
            io.to(roomCode).emit('voteUpdate', {
                voted: voteCount,
                total: totalPlayers
            });
            
            if (voteCount >= totalPlayers) {
                if (gameRoom.roundData.timer) {
                    clearTimeout(gameRoom.roundData.timer);
                    gameRoom.roundData.timer = null;
                }
                endJokeFactoryVoting(roomCode);
            }
        } catch (error) {
            handleSocketError('submitVote', error);
        }
    });

    // Handle guesses for Truth Tales
    socket.on('submitGuess', ({ roomCode, storyId, guessedAuthorId }) => {
        try {
            const gameRoom = gameRooms.get(roomCode);
            
            if (!gameRoom || gameRoom.gameType !== GAME_TYPES.TRUTH_TALES) {
                socket.emit('error', { message: 'Invalid room or game type' });
                return;
            }
            
            if (gameRoom.phase !== TRUTH_GAME_PHASES.STORY_GUESSING) {
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
                calculateTruthTalesResults(roomCode);
            }
        } catch (error) {
            handleSocketError('submitGuess', error);
        }
    });

    // Disconnect handling - unified for both games
    socket.on('disconnect', () => {
        try {
            console.log('Client disconnected:', socket.id);
            
            for (const [roomCode, gameRoom] of gameRooms.entries()) {
                const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
                
                if (playerIndex !== -1) {
                    const player = gameRoom.players[playerIndex];
                    gameRoom.players.splice(playerIndex, 1);
                    
                    // Clear any timers if needed
                    if (gameRoom.gameType === GAME_TYPES.JOKE_FACTORY && gameRoom.roundData && gameRoom.roundData.timer) {
                        clearTimeout(gameRoom.roundData.timer);
                        gameRoom.roundData.timer = null;
                    }
                    
                    // Handle host reassignment
                    if (gameRoom.host === socket.id && gameRoom.players.length > 0) {
                        gameRoom.host = gameRoom.players[0].id;
                        gameRoom.players[0].isHost = true;
                        
                        io.to(roomCode).emit('hostChanged', { 
                            newHost: gameRoom.players[0].name,
                            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
                        });
                    }
                    
                    if (gameRoom.players.length === 0) {
                        gameRooms.delete(roomCode);
                    } else {
                        io.to(roomCode).emit('playerLeft', { 
                            playerName: player.name,
                            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
                        });
                    }
                    
                    console.log(`Player ${player.name} left ${gameRoom.gameType} room ${roomCode}`);
                }
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

// Enhanced error handling for the server
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
});

// Start unified server with enhanced error handling
const PORT = process.env.PORT || 3000;

server.listen(PORT, (error) => {
    if (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
    
    console.log(`🎭 StandUp Showdown Platform running on port ${PORT}`);
    console.log(`🌐 Game Hub: http://localhost:${PORT}`);
    console.log(`🎤 Joke Factory: http://localhost:${PORT}/joke-factory`);
    console.log(`🕵️ Truth Tales: http://localhost:${PORT}/truth-tales`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`✅ Server started successfully!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});