// Initialize socket connection
const socket = io();

// Game state
let gameState = {
    roomCode: '',
    playerName: '',
    isHost: false,
    players: [],
    currentRound: 0,
    roundPhase: 'waiting', // waiting, writing, voting, results
    gameStarted: false,
    currentContent: null,
    hasSubmitted: false,
    hasVoted: false
};

// DOM elements
const landingPage = document.getElementById('landing-page');
const roomJoinPage = document.getElementById('room-join-page');
const hostScreen = document.getElementById('host-screen');
const playerScreen = document.getElementById('player-screen');
const gameRoundScreen = document.getElementById('game-round-screen');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const backBtn = document.getElementById('back-btn');
const startGameBtn = document.getElementById('start-game-btn');
const roomCodeInput = document.getElementById('room-code-input');
const playerNameInput = document.getElementById('player-name-input');
const roomCodeDisplay = document.getElementById('room-code-display');
const playerNameDisplay = document.getElementById('player-name-display');
const playerCount = document.getElementById('player-count');
const playerList = document.getElementById('player-list');
const audienceReaction = document.getElementById('audience-reaction');

// Game screen elements
const roundTitle = document.getElementById('round-title');
const roundDescription = document.getElementById('round-description');
const promptDisplay = document.getElementById('prompt-display');
const answerSection = document.getElementById('answer-section');
const jokeInput = document.getElementById('joke-input');
const submitJokeBtn = document.getElementById('submit-joke-btn');
const votingSection = document.getElementById('voting-section');
const votingOptions = document.getElementById('voting-options');
const resultsSection = document.getElementById('results-section');
const resultsDisplay = document.getElementById('results-display');

// Sound control elements
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const volumeSlider = document.getElementById('volume-slider');

// Initialize sound controls
function initializeSoundControls() {
    // Sound toggle button
    soundToggleBtn.addEventListener('click', () => {
        const isEnabled = soundManager.toggleSound();
        soundToggleBtn.textContent = isEnabled ? '🔊' : '🔇';
        soundToggleBtn.classList.toggle('muted', !isEnabled);
        
        if (isEnabled) {
            soundManager.playSuccess();
        }
    });

    // Volume slider
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        soundManager.setVolume(volume);
    });

    // Preload sounds when user first interacts with the page
    document.addEventListener('click', () => {
        soundManager.preloadSounds();
    }, { once: true });
}

// Navigation functions
function showLandingPage() {
    landingPage.style.display = 'flex';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'none';
    gameRoundScreen.style.display = 'none';
}

function showRoomJoinPage() {
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'flex';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'none';
    gameRoundScreen.style.display = 'none';
}

function showHostScreen() {
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'flex';
    playerScreen.style.display = 'none';
    gameRoundScreen.style.display = 'none';
}

function showPlayerScreen() {
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'flex';
    gameRoundScreen.style.display = 'none';
}

function showGameRoundScreen() {
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'none';
    gameRoundScreen.style.display = 'flex';
}

// Update player list display
function updatePlayerList() {
    playerList.innerHTML = '';
    gameState.players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        if (player.isHost) {
            playerElement.innerHTML = `${player.name} <span class="host-tag">(Host)</span>`;
        } else {
            playerElement.textContent = player.name;
        }
        playerList.appendChild(playerElement);
    });
    playerCount.textContent = gameState.players.length;
}

// Show audience reaction with sound and animation
function showAudienceReaction(reactionData) {
    if (!audienceReaction) return;
    
    // Map server reaction names to client reaction classes
    const reactionMap = {
        'crickets': 'crickets',
        'mild': 'mild-laugh',
        'medium': 'medium-laugh',
        'strong': 'big-laugh',
        'ovation': 'applause'
    };
    
    const reactionType = reactionMap[reactionData.reaction.name] || 'mild-laugh';
    
    // Clear previous reaction
    audienceReaction.className = 'audience-reaction';
    audienceReaction.innerHTML = '';
    
    // Set reaction content based on type
    let emoji = '';
    switch (reactionType) {
        case 'crickets':
            emoji = '🦗🦗🦗';
            break;
        case 'mild-laugh':
            emoji = '😊😄😊';
            break;
        case 'medium-laugh':
            emoji = '😂😄😂';
            break;
        case 'big-laugh':
            emoji = '🤣😂🤣';
            break;
        case 'applause':
            emoji = '👏🎉👏';
            break;
    }
    
    audienceReaction.innerHTML = emoji;
    audienceReaction.classList.add(reactionType);
    
    // Play corresponding sound
    soundManager.play(reactionType.replace('-', ''));
    
    // Remove reaction after duration
    setTimeout(() => {
        audienceReaction.classList.remove(reactionType);
    }, 3000);
}

// Display host commentary
function displayHostMessage(hostData) {
    // Create a temporary host message overlay
    const hostMessage = document.createElement('div');
    hostMessage.className = 'host-message';
    hostMessage.innerHTML = `
        <div class="host-bubble">
            <div class="host-avatar">🎭</div>
            <div class="host-text">${hostData.line}</div>
        </div>
    `;
    
    document.body.appendChild(hostMessage);
    
    // Play appropriate sound for host
    if (hostData.type === 'welcome' || hostData.type === 'finale') {
        soundManager.play('applause', 0.3);
    } else if (hostData.type === 'encouragement') {
        soundManager.play('ding', 0.4);
    } else {
        soundManager.play('ding', 0.2);
    }
    
    // Remove after 4 seconds
    setTimeout(() => {
        if (hostMessage.parentNode) {
            hostMessage.parentNode.removeChild(hostMessage);
        }
    }, 4000);
}

// Reset round UI
function resetRoundUI() {
    answerSection.style.display = 'block';
    votingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    jokeInput.value = '';
    jokeInput.disabled = false;
    submitJokeBtn.disabled = false;
    submitJokeBtn.textContent = 'Submit Joke';
    gameState.hasSubmitted = false;
    gameState.hasVoted = false;
}

// Display round content
function displayRoundContent(roundData) {
    roundTitle.textContent = `Round ${roundData.round}: ${roundData.roundName}`;
    
    // Set description based on round type
    switch (roundData.roundType) {
        case 'punchlines':
            roundDescription.textContent = 'Write a setup for the given punchline';
            promptDisplay.innerHTML = `<div class="punchline-display">Punchline: "${roundData.content}"</div>`;
            jokeInput.placeholder = 'Write your setup here...';
            break;
        case 'setups':
            roundDescription.textContent = 'Write a punchline for the given setup';
            promptDisplay.innerHTML = `<div class="setup-display">Setup: "${roundData.content}"</div>`;
            jokeInput.placeholder = 'Write your punchline here...';
            break;
        case 'topics':
            roundDescription.textContent = 'Write a complete joke about the given topic';
            promptDisplay.innerHTML = `<div class="topic-display">Topic: "${roundData.content}"</div>`;
            jokeInput.placeholder = 'Write your complete joke here...';
            break;
    }
    
    gameState.currentContent = roundData.content;
    gameState.roundPhase = 'writing';
    resetRoundUI();
}

// Display voting options
function displayVotingOptions(submissions) {
    votingOptions.innerHTML = '';
    
    submissions.forEach((submission, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'vote-option';
        optionElement.setAttribute('data-id', submission.id);
        optionElement.textContent = submission.text;
        
        optionElement.addEventListener('click', () => {
            // Remove previous selection
            document.querySelectorAll('.vote-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Select this option
            optionElement.classList.add('selected');
            
            // Submit vote
            if (!gameState.hasVoted) {
                socket.emit('submitVote', {
                    roomCode: gameState.roomCode,
                    submissionId: submission.id
                });
                gameState.hasVoted = true;
                soundManager.play('ding', 0.4);
            }
        });
        
        votingOptions.appendChild(optionElement);
    });
    
    answerSection.style.display = 'none';
    votingSection.style.display = 'block';
    gameState.roundPhase = 'voting';
}

// Display round results
function displayResults(resultsData) {
    resultsDisplay.innerHTML = '';
    
    resultsData.results.forEach((result, index) => {
        const resultElement = document.createElement('div');
        resultElement.className = `result-item ${index === 0 ? 'winner' : ''}`;
        resultElement.innerHTML = `
            <div class="result-player">${result.playerName}</div>
            <div class="result-submission">"${result.submission}"</div>
            <div class="vote-count">${result.votes} vote${result.votes !== 1 ? 's' : ''}</div>
        `;
        resultsDisplay.appendChild(resultElement);
    });
    
    // Show current scores
    const scoresElement = document.createElement('div');
    scoresElement.className = 'current-scores';
    scoresElement.innerHTML = '<h4>Current Scores:</h4>';
    
    resultsData.scores.forEach((score, index) => {
        const scoreElement = document.createElement('div');
        scoreElement.className = 'score-item';
        scoreElement.innerHTML = `${index + 1}. ${score.name}: ${score.score} points`;
        scoresElement.appendChild(scoreElement);
    });
    
    resultsDisplay.appendChild(scoresElement);
    
    votingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    gameState.roundPhase = 'results';
}

// Event listeners
createRoomBtn.addEventListener('click', () => {
    const playerName = prompt('Enter your nickname:');
    if (!playerName || playerName.trim().length < 2) {
        alert('Please enter a valid nickname (at least 2 characters)');
        return;
    }
    
    gameState.playerName = playerName.trim();
    playerNameDisplay.textContent = gameState.playerName;
    
    soundManager.playSuccess();
    socket.emit('createRoom', { playerName: gameState.playerName });
});

joinRoomBtn.addEventListener('click', () => {
    showRoomJoinPage();
});

joinGameBtn.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.toUpperCase().trim();
    const playerName = playerNameInput.value.trim();
    
    if (roomCode.length !== 4) {
        alert('Room code must be 4 letters');
        return;
    }
    
    if (!playerName || playerName.trim().length < 2) {
        alert('Please enter a valid nickname (at least 2 characters)');
        return;
    }
    
    gameState.playerName = playerName.trim();
    playerNameDisplay.textContent = gameState.playerName;
    
    soundManager.playSuccess();
    socket.emit('joinRoom', { roomCode, playerName: gameState.playerName });
});

backBtn.addEventListener('click', () => {
    showLandingPage();
});

startGameBtn.addEventListener('click', () => {
    if (gameState.players.length < 3) {
        alert('Need at least 3 players to start the game');
        return;
    }
    
    soundManager.playDrumroll();
    socket.emit('startGame', { roomCode: gameState.roomCode });
});

// Submit joke/answer
submitJokeBtn.addEventListener('click', () => {
    const answer = jokeInput.value.trim();
    if (!answer) {
        alert('Please write something before submitting!');
        return;
    }
    
    if (gameState.hasSubmitted) {
        return;
    }
    
    socket.emit('submitAnswer', {
        roomCode: gameState.roomCode,
        answer: answer
    });
    
    soundManager.play('ding', 0.5);
});

// Socket event listeners
socket.on('roomCreated', ({ roomCode, isHost, players }) => {
    gameState.roomCode = roomCode;
    gameState.isHost = isHost;
    gameState.players = players;
    
    roomCodeDisplay.textContent = roomCode;
    updatePlayerList();
    showHostScreen();
    
    console.log(`Room created: ${roomCode}`);
});

socket.on('roomJoined', ({ roomCode, isHost, players }) => {
    gameState.roomCode = roomCode;
    gameState.isHost = isHost;
    gameState.players = players;
    
    updatePlayerList();
    showPlayerScreen();
    
    console.log(`Joined room: ${roomCode}`);
});

socket.on('playerJoined', ({ players }) => {
    gameState.players = players;
    updatePlayerList();
    soundManager.play('ding', 0.3);
    console.log('A new player joined the room');
});

socket.on('playerLeft', ({ playerName, players }) => {
    gameState.players = players;
    updatePlayerList();
    console.log(`${playerName} left the room`);
});

socket.on('hostChanged', ({ newHost, players }) => {
    gameState.players = players;
    updatePlayerList();
    
    if (gameState.playerName === newHost) {
        gameState.isHost = true;
        alert('You are now the host!');
        showHostScreen();
        soundManager.playSuccess();
    }
    
    console.log(`${newHost} is now the host`);
});

socket.on('hostSpeaks', (hostData) => {
    displayHostMessage(hostData);
    console.log('Host says:', hostData.line);
});

socket.on('gameStarting', ({ message, totalPlayers }) => {
    gameState.gameStarted = true;
    showGameRoundScreen();
    
    // Show excitement reaction
    if (audienceReaction) {
        audienceReaction.innerHTML = '🎉🎭🎉';
        audienceReaction.className = 'audience-reaction applause';
        setTimeout(() => {
            audienceReaction.classList.remove('applause');
        }, 3000);
    }
    
    soundManager.play('applause', 0.4);
    alert(message);
    console.log('Game starting with', totalPlayers, 'players');
});

socket.on('roundStarted', (roundData) => {
    displayRoundContent(roundData);
    soundManager.playDrumroll();
    console.log(`Round ${roundData.round} started:`, roundData.roundName);
});

socket.on('submissionReceived', () => {
    gameState.hasSubmitted = true;
    jokeInput.disabled = true;
    submitJokeBtn.disabled = true;
    submitJokeBtn.textContent = 'Submitted!';
    soundManager.play('ding', 0.6);
});

socket.on('submissionUpdate', ({ submitted, total }) => {
    console.log(`Submissions: ${submitted}/${total}`);
    // Could show progress indicator here
});

socket.on('votingStarted', ({ submissions, timeLimit }) => {
    displayVotingOptions(submissions);
    soundManager.play('drumroll', 0.3);
    console.log('Voting started with', submissions.length, 'submissions');
});

socket.on('voteReceived', () => {
    soundManager.play('ding', 0.4);
    console.log('Vote submitted successfully');
});

socket.on('voteUpdate', ({ voted, total }) => {
    console.log(`Votes: ${voted}/${total}`);
    // Could show progress indicator here
});

socket.on('audienceReaction', (reactionData) => {
    showAudienceReaction(reactionData);
    console.log('Audience reaction:', reactionData.reaction.name);
});

socket.on('roundResults', (resultsData) => {
    displayResults(resultsData);
    
    // Play reaction for the winner
    if (resultsData.results.length > 0) {
        const topVotes = resultsData.results[0].votes;
        const totalPlayers = gameState.players.length;
        
        setTimeout(() => {
            if (topVotes === 0) {
                soundManager.play('crickets');
            } else if (topVotes >= totalPlayers * 0.8) {
                soundManager.play('applause');
            } else if (topVotes >= totalPlayers * 0.6) {
                soundManager.play('biglaughter');
            } else {
                soundManager.play('mediumlaughter');
            }
        }, 1000);
    }
    
    console.log('Round results received');
});

socket.on('gameEnded', ({ winner, finalScores }) => {
    gameState.gameStarted = false;
    
    soundManager.play('applause');
    if (audienceReaction) {
        audienceReaction.innerHTML = '🏆👏🎉';
        audienceReaction.className = 'audience-reaction applause';
    }
    
    setTimeout(() => {
        alert(`Game Over!\n\nWinner: ${winner.name} with ${winner.score} points!\n\nFinal Scores:\n${finalScores.map((score, i) => `${i + 1}. ${score.name}: ${score.score} points`).join('\n')}`);
        
        // Return to appropriate screen
        if (gameState.isHost) {
            showHostScreen();
        } else {
            showPlayerScreen();
        }
    }, 2000);
    
    console.log('Game ended. Winner:', winner.name);
});

socket.on('error', ({ message }) => {
    soundManager.play('crickets', 0.2);
    alert(`Error: ${message}`);
    console.error('Socket error:', message);
});

// Connection status
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Add click sounds to all buttons
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn')) {
        soundManager.play('ding', 0.3);
    }
});

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSoundControls();
    showLandingPage();
    console.log('StandUp Showdown client loaded successfully!');
});