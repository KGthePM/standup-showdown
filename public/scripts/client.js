// Initialize socket connection
const socket = io();

// Game state
let gameState = {
    roomCode: '',
    playerName: '',
    isHost: false,
    players: [],
    currentRound: 0,
    gameStarted: false
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
            playerElement.innerHTML = `${player.name} <span class="host-tag">(Host)</span>`;
        } else {
            playerElement.textContent = player.name;
        }
        playerList.appendChild(playerElement);
    });
    playerCount.textContent = gameState.players.length;
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

socket.on('gameStarted', ({ round, roundName, message }) => {
    gameState.gameStarted = true;
    gameState.currentRound = round;
    
    alert(message);
    
    console.log(`Game started: ${roundName}`);
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