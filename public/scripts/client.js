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
    phase: 'waiting',
    currentSubmissions: [],
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

// Timer variables
let timer = null;
let timeLeft = 0;

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
            playerElement.innerHTML = `${player.name} <span class="host-tag">(Host)</span> - ${player.score} points`;
        } else {
            playerElement.innerHTML = `${player.name} - ${player.score} points`;
        }
        playerList.appendChild(playerElement);
    });
    playerCount.textContent = gameState.players.length;
}

// Timer functions
function startTimer(duration, onComplete) {
    timeLeft = duration;
    updateTimerDisplay();
    
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (onComplete) onComplete();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = `Time left: ${timeLeft}s`;
    }
}

function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

// Game UI functions
function showSubmissionUI(roundData) {
    gameState.hasSubmitted = false;
    
    let html = `
        <div class="round-info">
            <h3>Round ${gameState.currentRound}</h3>
            <div id="timer">Time left: 90s</div>
            <div class="content-box">
                <p>${roundData.instruction}</p>
    `;
    
    if (roundData.roundData.punchline) {
        html += `<div class="punchline-display">"${roundData.roundData.punchline}"</div>`;
    } else if (roundData.roundData.setup) {
        html += `<div class="setup-display">"${roundData.roundData.setup}"</div>`;
    } else if (roundData.roundData.topic) {
        html += `<div class="topic-display">Topic: ${roundData.roundData.topic}</div>`;
    }
    
    html += `
            </div>
            <div class="answer-form">
                <textarea id="answer-input" placeholder="Write your answer here..." rows="4"></textarea>
                <button class="btn" id="submit-answer-btn">Submit Answer</button>
            </div>
        </div>
    `;
    
    gameControls.innerHTML = html;
    
    // Add event listener for submit button
    document.getElementById('submit-answer-btn').addEventListener('click', () => {
        const answer = document.getElementById('answer-input').value.trim();
        if (answer.length < 3) {
            alert('Please write a longer answer!');
            return;
        }
        
        socket.emit('submitAnswer', { roomCode: gameState.roomCode, answer });
        gameState.hasSubmitted = true;
        
        // Update UI to show submission received
        gameControls.innerHTML = `
            <div class="round-info">
                <h3>Round ${gameState.currentRound}</h3>
                <div class="content-box">
                    <p>✅ Your answer has been submitted!</p>
                    <p>Waiting for other players...</p>
                </div>
            </div>
        `;
    });
    
    startTimer(roundData.timeLimit);
}

function showVotingUI(votingData) {
    gameState.hasVoted = false;
    gameState.currentSubmissions = votingData.submissions;
    
    let html = `
        <div class="round-info">
            <h3>Voting Time!</h3>
            <div id="timer">Time left: 60s</div>
            <div class="content-box">
                <p>Vote for the best answer:</p>
                <div class="submissions-list">
    `;
    
    votingData.submissions.forEach((submission, index) => {
        // Don't show player's own submission for voting
        if (submission.id !== socket.id) {
            html += `
                <div class="submission-item">
                    <p>"${submission.text}"</p>
                    <button class="btn vote-btn" data-player-id="${submission.id}">
                        Vote for this one
                    </button>
                </div>
            `;
        }
    });
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    gameControls.innerHTML = html;
    
    // Add event listeners for vote buttons
    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const votedFor = e.target.getAttribute('data-player-id');
            socket.emit('submitVote', { roomCode: gameState.roomCode, votedFor });
            gameState.hasVoted = true;
            
            // Update UI to show vote received
            gameControls.innerHTML = `
                <div class="round-info">
                    <h3>Voting Time!</h3>
                    <div class="content-box">
                        <p>✅ Your vote has been submitted!</p>
                        <p>Waiting for other players...</p>
                    </div>
                </div>
            `;
        });
    });
    
    startTimer(votingData.timeLimit);
}

function showResultsUI(resultsData) {
    stopTimer();
    
    let html = `
        <div class="round-info">
            <h3>Round ${gameState.currentRound} Results</h3>
            <div class="content-box">
    `;
    
    if (resultsData.winners.length === 1) {
        html += `<p>🏆 Winner: ${resultsData.winners[0]}!</p>`;
    } else {
        html += `<p>🏆 Tie between: ${resultsData.winners.join(', ')}!</p>`;
    }
    
    html += `<div class="results-list">`;
    
    resultsData.results.forEach((result, index) => {
        const trophy = result.isWinner ? '🏆 ' : '';
        html += `
            <div class="result-item ${result.isWinner ? 'winner' : ''}">
                <p><strong>${trophy}${result.playerName}</strong></p>
                <p>"${result.text}"</p>
                <p>Votes: ${result.votes}</p>
            </div>
        `;
    });
    
    html += `</div>`;
    
    if (gameState.currentRound < 3) {
        html += `<p>Next round starting soon...</p>`;
    } else {
        html += `<p>Final round complete! Calculating overall winner...</p>`;
    }
    
    html += `
            </div>
        </div>
    `;
    
    gameControls.innerHTML = html;
}

function showGameEndUI(endData) {
    let html = `
        <div class="round-info">
            <h3>🎉 Game Complete! 🎉</h3>
            <div class="content-box">
                <p><strong>Overall Winner: ${endData.winner}!</strong></p>
                <div class="final-scores">
                    <h4>Final Scores:</h4>
    `;
    
    endData.finalScores.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        html += `<p>${medal} ${player.name}: ${player.score} points</p>`;
    });
    
    html += `
                </div>
                <button class="btn" onclick="location.reload()">Play Again</button>
            </div>
        </div>
    `;
    
    gameControls.innerHTML = html;
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
    
    if (gameState.playerName === newHost) {
        gameState.isHost = true;
        alert('You are now the host!');
        showHostScreen();
    }
    
    console.log(`${newHost} is now the host`);
});

socket.on('gameStarted', ({ message }) => {
    gameState.gameStarted = true;
    alert(message);
    
    // Show waiting message
    if (!gameState.isHost) {
        gameControls.innerHTML = `
            <div class="round-info">
                <h3>Game Starting...</h3>
                <div class="content-box">
                    <p>Get ready for the first round!</p>
                </div>
            </div>
        `;
    }
    
    console.log('Game started');
});

socket.on('roundStarted', (roundData) => {
    gameState.currentRound = roundData.round;
    gameState.phase = 'submitting';
    
    if (!gameState.isHost) {
        showSubmissionUI(roundData);
    } else {
        // Host sees the round info but doesn't participate
        gameControls.innerHTML = `
            <div class="round-info">
                <h3>${roundData.roundName} - Round ${roundData.round}</h3>
                <div class="content-box">
                    <p>${roundData.instruction}</p>
                    <p>Players are submitting their answers...</p>
                    <div id="timer">Time left: ${roundData.timeLimit}s</div>
                </div>
            </div>
        `;
        startTimer(roundData.timeLimit);
    }
    
    console.log(`Round ${roundData.round} started: ${roundData.roundName}`);
});

socket.on('votingStarted', (votingData) => {
    gameState.phase = 'voting';
    
    if (!gameState.isHost) {
        showVotingUI(votingData);
    } else {
        // Host sees voting info
        gameControls.innerHTML = `
            <div class="round-info">
                <h3>Voting Phase</h3>
                <div class="content-box">
                    <p>Players are voting on their favorite answers...</p>
                    <div id="timer">Time left: ${votingData.timeLimit}s</div>
                    <div class="submissions-preview">
                        <h4>Submitted Answers:</h4>
                        ${votingData.submissions.map(s => `<p>"${s.text}" - ${s.playerName}</p>`).join('')}
                    </div>
                </div>
            </div>
        `;
        startTimer(votingData.timeLimit);
    }
    
    console.log('Voting phase started');
});

socket.on('roundResults', (resultsData) => {
    gameState.phase = 'results';
    gameState.players = resultsData.players; // Update scores
    
    showResultsUI(resultsData);
    updatePlayerList(); // Update the player list with new scores
    
    console.log(`Round ${gameState.currentRound} results:`, resultsData.winners);
});

socket.on('gameEnded', (endData) => {
    gameState.gameStarted = false;
    gameState.phase = 'ended';
    
    showGameEndUI(endData);
    
    console.log(`Game ended. Winner: ${endData.winner}`);
});

socket.on('submissionReceived', ({ message }) => {
    console.log(message);
});

socket.on('voteReceived', ({ message }) => {
    console.log(message);
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