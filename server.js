const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { getRandomContent, getUniqueContentForPlayers } = require('./content');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ========================================
// STATIC FILE SERVING & ROUTES
// ========================================

app.use('/joke-factory', express.static(path.join(__dirname, 'public')));
app.use('/truth-tales', express.static(path.join(__dirname, 'games/truth-tales/public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/joke-factory', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/truth-tales', (req, res) => {
    res.sendFile(path.join(__dirname, 'games/truth-tales/public', 'index.html'));
});

// ========================================
// GAME DATA STORAGE
// ========================================

const gameRooms = new Map();

const GAME_TYPES = {
    JOKE_FACTORY: 'joke_factory',
    TRUTH_TALES: 'truth_tales'
};

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

const TIMER_DURATION = 90;
const VOTING_DURATION = 30;

const AUDIENCE_REACTIONS = {
    CRICKETS: { threshold: 0, name: 'crickets', message: '🦗 *crickets chirping*', hostLine: "Well... that was... something. Moving on!" },
    MILD: { threshold: 0.2, name: 'mild', message: '😊 *polite chuckles*', hostLine: "Hey, I heard a laugh! Or was that a cough?" },
    MEDIUM: { threshold: 0.4, name: 'medium', message: '😄 *genuine laughter*', hostLine: "Now we're cooking! The audience is warming up!" },
    STRONG: { threshold: 0.6, name: 'strong', message: '😂 *big laughs and applause*', hostLine: "That's what I'm talking about! Comedy gold!" },
    STANDING_OVATION: { threshold: 0.8, name: 'ovation', message: '🎉 *standing ovation*', hostLine: "INCREDIBLE! Someone get this person a Netflix special!" }
};

const HOST_LINES = {
    gameStart: [
        "Ladies and gentlemen, welcome to StandUp Showdown! I'm your host, and I've seen funnier things at a DMV, but let's see what you've got!",
        "Welcome comedy legends! Or should I say... comedy leg-ends? Because some of these jokes might not have legs!",
        "It's showtime! Remember, timing is everything in comedy. That's why I'm always late to parties!",
        "Welcome to StandUp Showdown, where dreams come true and egos get bruised!"
    ],
    roundIntros: {
        1: ["Time for Setup Battle! Remember, a good setup is like a good relationship - it needs a strong foundation before the punchline hits!", "Setup Battle begins! You'll get a punchline, you write the setup. It's like Jeopardy, but funny!", "Round 1: Setup Battle! Show us how you get to these punchlines. GPS not included!"],
        2: ["Punchline Challenge is up! This is where we separate the comedians from the people who think they're funny at parties!", "Time to deliver those punchlines! Remember, it's all about the delivery. Unlike my pizza, which never arrives!", "Punchline Challenge! The setup is ready, now stick the landing!"],
        3: ["Full Joke Creation - no training wheels! Time to show us if you're Netflix special material or open mic nightmare!", "The final round! Write a complete joke. This is your moment to shine... or crash and burn spectacularly!", "Full Joke Creation! You've got a topic, now make us laugh! No pressure, but your comedy career depends on it!"]
    },
    betweenSubmissions: ["While our comedians are crafting their masterpieces, did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them!", "Everyone's typing away! Remember, comedy is 10% inspiration and 90% desperation!", "I can feel the creative energy! Or is that just the air conditioning?"],
    votingStart: ["Time to vote! Remember, you can't vote for yourself. That's like laughing at your own jokes... which I definitely don't do...", "Voting time! Pick your favorite, and try not to play favorites. Unless it's really funny, then absolutely play favorites!", "Let's see which jokes land and which ones... well, let's stay positive!"],
    noVotes: ["Ouch! Zero votes. But hey, bombing is a rite of passage in comedy! You're basically a pro now!", "No votes, but don't worry - even Jerry Seinfeld bombed once. Well, probably more than once.", "Zero votes? That's not a failure, that's avant-garde comedy! Very experimental!"],
    winner: ["And the winner is {name}! Someone call Netflix, we've got a star!", "Congratulations to {name}! You've won the game and my respect, which is worth... well, nothing, but still!", "{name} takes the crown! Your prize? The satisfaction of being funnier than your friends!"],
    encouragement: ["Great submission! I actually laughed, and my standards are pretty low!", "That's the spirit! Keep them coming!", "I see what you did there! Comedy genius or happy accident? We'll never know!"]
};

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
    const votePercentage = votes / (totalPlayers - 1);
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
    do {
        roomCode = generateRoomCode();
    } while (gameRooms.has(roomCode));

    if (gameType === GAME_TYPES.JOKE_FACTORY) {
        gameRooms.set(roomCode, {
            gameType: GAME_TYPES.JOKE_FACTORY,
            players: [],
            host: null,
            gameStarted: false,
            currentRound: 0,
            roundPhase: 'waiting',
            roundData: { content: [], submissions: {}, votes: {}, timer: null },
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

    const hostLine = getRandomHostLine('roundIntros')[roundNumber];
    io.to(roomCode).emit('hostSpeaks', { line: hostLine, type: 'roundIntro' });

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
    }, 3000);

    setTimeout(() => {
        if (gameRoom.roundPhase === 'writing') {
            io.to(roomCode).emit('hostSpeaks', { line: getRandomHostLine('betweenSubmissions'), type: 'encouragement' });
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

    io.to(roomCode).emit('hostSpeaks', { line: getRandomHostLine('votingStart'), type: 'voting' });

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
        if (!gameRoom.scores[playerId]) gameRoom.scores[playerId] = 0;
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
    
    io.to(roomCode).emit('hostSpeaks', { line: winnerLine, type: 'finale' });

    setTimeout(() => {
        io.to(roomCode).emit('gameEnded', {
            winner: finalScores[0],
            finalScores: finalScores
        });
    }, 3000);

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
        
        gameRoom.scores[story.authorId] = (gameRoom.scores[story.authorId] || 0) + (totalGuesses - correctGuesses);
        
        Object.entries(story.guesses).forEach(([guesserId, guessedAuthorId]) => {
            if (guessedAuthorId === story.authorId) {
                gameRoom.scores[guesserId] = (gameRoom.scores[guesserId] || 0) + 2;
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
    
    gameRoom.gameStarted = false;
    gameRoom.currentRound = 0;
    gameRoom.phase = TRUTH_GAME_PHASES.WAITING;
    gameRoom.stories = [];
    gameRoom.scores = {};
}

// ========================================
// UNIFIED SOCKET.IO EVENT HANDLING
// ========================================

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('createRoom', ({ playerName, gameType }) => {
        const actualGameType = gameType || GAME_TYPES.JOKE_FACTORY;
        const roomCode = createGameRoom(actualGameType);
        const gameRoom = gameRooms.get(roomCode);
        
        gameRoom.host = socket.id;
        gameRoom.players.push({ id: socket.id, name: playerName, isHost: true, score: 0 });
        
        socket.join(roomCode);
        
        socket.emit('roomCreated', { 
            roomCode, 
            isHost: true,
            gameType: actualGameType,
            players: gameRoom.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
        });
        
        console.log(`${actualGameType} room created: ${roomCode} by ${playerName}`);
    });

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
        
        const maxPlayers = gameRoom.gameType === GAME_TYPES.JOKE_FACTORY ? 6 : 8;
        if (gameRoom.players.length >= maxPlayers) {
            socket.emit('error', { message: `Room is full (max ${maxPlayers} players)` });
            return;
        }
        
        if (gameRoom.players.some(p => p.name === playerName)) {
            socket.emit('error', { message: 'Name already taken in this room' });
            return;
        }
        
        gameRoom.players.push({ id: socket.id, name: playerName, isHost: false, score: 0 });
        
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
    });

    socket.on('startGame', ({ roomCode }) => {
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
        
        gameRoom.players.forEach(player => {
            gameRoom.scores[player.id] = 0;
        });
        
        if (gameRoom.gameType === GAME_TYPES.JOKE_FACTORY) {
            io.to(roomCode).emit('hostSpeaks', { line: getRandomHostLine('gameStart'), type: 'welcome' });
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
    });

    socket.on('submitAnswer', ({ roomCode, answer }) => {
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
    });

    socket.on('submitStory', ({ roomCode, story }) => {
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
        
        socket.emit('storySubmitted', { message: 'Story submitted successfully!' });
        
        const submissionCount = gameRoom.stories.length;
        if (submissionCount >= gameRoom.players.length) {
            gameRoom.phase = TRUTH_GAME_PHASES.STORY_GUESSING;
            const shuffledStories = gameRoom.stories
                .map(story => ({ id: story.id, text: story.text }))
                .sort(() => Math.random() - 0.5);
            io.to(roomCode).emit('guessingPhase', {
                stories: shuffledStories,
                players: gameRoom.players.map(p => ({ id: p.id, name: p.name }))
            });
        }
    });

    socket.on('submitVote', ({ roomCode, submissionId }) => {
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
    });

    socket.on('submitGuess', ({ roomCode, storyId, guessedAuthorId }) => {
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
        
        const totalGuessesNeeded = gameRoom.stories.length * gameRoom.players.length;
        const totalGuessesReceived = gameRoom.stories.reduce((total, story) => 
            total + Object.keys(story.guesses).length, 0);
        
        if (totalGuessesReceived >= totalGuessesNeeded) {
            calculateTruthTalesResults(roomCode);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        for (const [roomCode, gameRoom] of gameRooms.entries()) {
            const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const player = gameRoom.players[playerIndex];
                gameRoom.players.splice(playerIndex, 1);
                
                if (gameRoom.gameType === GAME_TYPES.JOKE_FACTORY && gameRoom.roundData.timer) {
                    clearTimeout(gameRoom.roundData.timer);
                    gameRoom.roundData.timer = null;
                }
                
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
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎭 StandUp Showdown Platform running on port ${PORT}`);
    console.log(`🌐 Game Hub: http://localhost:${PORT}`);
    console.log(`🎤 Joke Factory: http://localhost:${PORT}/joke-factory`);
    console.log(`🕵️ Truth Tales: http://localhost:${PORT}/truth-tales`);
});