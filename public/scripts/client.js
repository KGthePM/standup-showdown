// Initialize socket connection
const socket = io();

// Game state
let gameState = {
    roomCode: '',
    playerName: '',
    isHost: false,
    players: [],
    currentRound: 0,
    gameStarted: false,
    roundPhase: 'waiting',
    currentContent: '',
    hasSubmitted: false,
    hasVoted: false
};

// DOM elements
const landingPage = document.getElementById('landing-page');
const roomJoinPage = document.getElementById('room-join-page');
const hostScreen = document.getElementById('host-screen');
const playerScreen = document.getElementById('player-screen');
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
const gameControls = document.getElementById('game-controls');

// Navigation functions
function showLandingPage() {
    landingPage.style.display = 'flex';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'none';
}

function showRoomJoinPage() {
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'flex';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'none';
}

function showHostScreen() {
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'flex';
    playerScreen.style.display = 'none';
}

function showPlayerScreen() {
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'flex';
}

// Update player list display
function updatePlayerList() {
    playerList.innerHTML = '';
    gameState.players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        if (player.isHost) {
            playerElement.innerHTML = `${player.name} <span class="host-tag">(Host)</span> - Score: ${player.score || 0}`;
        } else {
            playerElement.textContent = `${player.name} - Score: ${player.score || 0}`;
        }
        playerList.appendChild(playerElement);
    });
    playerCount.textContent = gameState.players.length;
}

// Game UI functions
function showWritingInterface(roundData) {
    let promptText = '';
    let placeholderText = '';
    
    switch (roundData.roundType) {
        case 'punchlines':
            promptText = `Write a setup for this punchline:`;
            placeholderText = 'Write your setup here...';
            break;
        case 'setups':
            promptText = `Write a punchline for this setup:`;
            placeholderText = 'Write your punchline here...';
            break;
        case 'topics':
            promptText = `Create a joke about:`;
            placeholderText = 'Write your complete joke here...';
            break;
    }
    
    gameControls.innerHTML = `
        <div class="round-info">
            <h3>${roundData.roundName}</h3>
            <p>${promptText}</p>
            <div class="content-box">
                <div class="${roundData.roundType.slice(0, -1)}-display">${roundData.content}</div>
            </div>
            <div class="answer-form">
                <textarea id="answer-input" placeholder="${placeholderText}" rows="4"></textarea>
                <button class="btn" id="submit-answer-btn">Submit Answer</button>
            </div>
            <div id="timer-display">Time remaining: ${roundData.timeLimit}s</div>
            <div id="submission-status">Waiting for submissions...</div>
        </div>
    `;
    
    // Set up timer
    let timeLeft = roundData.timeLimit;
    const timerDisplay = document.getElementById('timer-display');
    const timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time remaining: ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            timerDisplay.textContent = 'Time\'s up!';
        }
    }, 1000);
    
    // Set up submit button
    const submitBtn = document.getElementById('submit-answer-btn');
    const answerInput = document.getElementById('answer-input');
    
    submitBtn.addEventListener('click', () => {
        const answer = answerInput.value.trim();
        if (answer.length < 5) {
            alert('Please write a longer answer (at least 5 characters)');
            return;
        }
        
        socket.emit('submitAnswer', { 
            roomCode: gameState.roomCode, 
            answer: answer 
        });
        
        submitBtn.disabled = true;
        answerInput.disabled = true;
        submitBtn.textContent = 'Submitted!';
        gameState.hasSubmitted = true;
    });
}

function showVotingInterface(votingData) {
    gameControls.innerHTML = `
        <div class="round-info">
            <h3>Voting Time!</h3>
            <p>Vote for your favorite answer (you can't vote for your own):</p>
            <div id="voting-options"></div>
            <div id="voting-timer">Time remaining: ${votingData.timeLimit}s</div>
            <div id="vote-status">Waiting for votes...</div>
        </div>
    `;
    
    const votingOptions = document.getElementById('voting-options');
    
    votingData.submissions.forEach(submission => {
        const optionElement = document.createElement('div');
        optionElement.className = 'voting-option';
        optionElement.innerHTML = `
            <button class="btn vote-btn" data-submission-id="${submission.id}">
                ${submission.text}
            </button>
        `;
        votingOptions.appendChild(optionElement);
    });
    
    // Set up voting timer
    let timeLeft = votingData.timeLimit;
    const timerDisplay = document.getElementById('voting-timer');
    const timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time remaining: ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            timerDisplay.textContent = 'Time\'s up!';
        }
    }, 1000);
    
    // Set up vote buttons
    const voteButtons = document.querySelectorAll('.vote-btn');
    voteButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const submissionId = parseInt(btn.dataset.submissionId);
            
            socket.emit('submitVote', {
                roomCode: gameState.roomCode,
                submissionId: submissionId
            });
            
            // Disable all vote buttons
            voteButtons.forEach(b => b.disabled = true);
            btn.style.backgroundColor = 'var(--accent-color)';
            btn.textContent += ' ✓';
            gameState.hasVoted = true;
        });
    });
}

function showResults(resultsData) {
    let resultsHTML = `
        <div class="round-info">
            <h3>Round Results</h3>
            <div class="results-list">
    `;
    
    resultsData.results.forEach((result, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        resultsHTML += `
            <div class="result-item">
                <div class="result-rank">${medal} ${index + 1}.</div>
                <div class="result-content">
                    <div class="result-text">"${result.submission}"</div>
                    <div class="result-author">by ${result.playerName}</div>
                    <div class="result-votes">${result.votes} vote${result.votes !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `;
    });
    
    resultsHTML += `
            </div>
            <h4>Current Scores</h4>
            <div class="scores-list">
    `;
    
    resultsData.scores.forEach((score, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        resultsHTML += `
            <div class="score-item">
                ${medal} ${score.name}: ${score.score} points
            </div>
        `;
    });
    
    resultsHTML += `
            </div>
            <p>Next round starting soon...</p>
        </div>
    `;
    
    gameControls.innerHTML = resultsHTML;
}

function showGameEnd(gameEndData) {
    let endHTML = `
        <div class="round-info">
            <h3>🎉 Game Over! 🎉</h3>
            <div class="winner-announcement">
                <h2>Winner: ${gameEndData.winner.name}!</h2>
                <p>Final Score: ${gameEndData.winner.score} points</p>
            </div>
            <h4>Final Standings</h4>
            <div class="final-scores-list">
    `;
    
    gameEndData.finalScores.forEach((score, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        endHTML += `
            <div class="final-score-item">
                ${medal} ${index + 1}. ${score.name}: ${score.score} points
            </div>
        `;
    });
    
    endHTML += `
            </div>
            <button class="btn" onclick="location.reload()">Play Again</button>
        </div>
    `;
    
    gameControls.innerHTML = endHTML;
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
    
    // Send request to server to create room
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
    
    // Send request to server to join room
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
    
    // Send request to server to start game
    socket.emit('startGame', { roomCode: gameState.roomCode });
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
    
    // Check if current player is the new host
    if (gameState.playerName === newHost) {
        gameState.isHost = true;
        alert('You are now the host!');
        showHostScreen();
    }
    
    console.log(`${newHost} is now the host`);
});

socket.on('roundStarted', (roundData) => {
    gameState.gameStarted = true;
    gameState.currentRound = roundData.round;
    gameState.roundPhase = 'writing';
    gameState.currentContent = roundData.content;
    gameState.hasSubmitted = false;
    gameState.hasVoted = false;
    
    if (gameState.isHost) {
        // Update host screen with round info
        hostScreen.querySelector('.card h2').textContent = `Round ${roundData.round}: ${roundData.roundName}`;
    }
    
    showWritingInterface(roundData);
    
    console.log(`Round ${roundData.round} started: ${roundData.roundName}`);
});

socket.on('votingStarted', (votingData) => {
    gameState.roundPhase = 'voting';
    showVotingInterface(votingData);
    
    console.log('Voting phase started');
});

socket.on('roundResults', (resultsData) => {
    gameState.roundPhase = 'results';
    gameState.players = resultsData.scores.map(score => {
        const player = gameState.players.find(p => p.name === score.name);
        return { ...player, score: score.score };
    });
    
    showResults(resultsData);
    updatePlayerList();
    
    console.log('Round results received');
});

socket.on('gameEnded', (gameEndData) => {
    gameState.gameStarted = false;
    showGameEnd(gameEndData);
    
    console.log(`Game ended. Winner: ${gameEndData.winner.name}`);
});

socket.on('submissionReceived', () => {
    console.log('Submission received by server');
});

socket.on('submissionUpdate', ({ submitted, total }) => {
    const statusElement = document.getElementById('submission-status');
    if (statusElement) {
        statusElement.textContent = `Submissions: ${submitted}/${total}`;
    }
});

socket.on('voteReceived', () => {
    console.log('Vote received by server');
});

socket.on('voteUpdate', ({ voted, total }) => {
    const statusElement = document.getElementById('vote-status');
    if (statusElement) {
        statusElement.textContent = `Votes: ${voted}/${total}`;
    }
});

socket.on('error', ({ message }) => {
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

// Initialize the game
showLandingPage();
console.log('StandUp Showdown client loaded successfully!');