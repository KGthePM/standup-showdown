// Initialize socket connection
const socket = io();

// Game state with game type detection
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
    hasVoted: false,
    gameType: detectGameType() // Auto-detect which game this is
};

// Detect game type based on current URL path
function detectGameType() {
    const path = window.location.pathname;
    if (path.includes('/truth-tales')) {
        return 'truth_tales';
    } else if (path.includes('/joke-factory')) {
        return 'joke_factory';
    }
    // Default fallback
    return 'joke_factory';
}

// DOM elements (same as before)
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

// Initialize sound controls (same as before)
function initializeSoundControls() {
    if (soundToggleBtn && typeof soundManager !== 'undefined') {
        soundToggleBtn.addEventListener('click', () => {
            const isEnabled = soundManager.toggleSound();
            soundToggleBtn.textContent = isEnabled ? '🔊' : '🔇';
            soundToggleBtn.classList.toggle('muted', !isEnabled);
            
            if (isEnabled) {
                soundManager.playSuccess();
            }
        });
    }

    if (volumeSlider && typeof soundManager !== 'undefined') {
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            soundManager.setVolume(volume);
        });
    }

    document.addEventListener('click', () => {
        if (typeof soundManager !== 'undefined') {
            soundManager.preloadSounds();
        }
    }, { once: true });
}

// Navigation functions (same as before)
function showLandingPage() {
    console.log('🎯 Showing landing page');
    landingPage.style.display = 'flex';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'none';
    gameRoundScreen.style.display = 'none';
}

function showRoomJoinPage() {
    console.log('🎯 Showing room join page');
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'flex';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'none';
    gameRoundScreen.style.display = 'none';
}

function showHostScreen() {
    console.log('🎯 Showing host screen');
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'flex';
    playerScreen.style.display = 'none';
    gameRoundScreen.style.display = 'none';
}

function showPlayerScreen() {
    console.log('🎯 Showing player screen');
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'flex';
    gameRoundScreen.style.display = 'none';
}

function showGameRoundScreen() {
    console.log('🎯 Showing game round screen');
    landingPage.style.display = 'none';
    roomJoinPage.style.display = 'none';
    hostScreen.style.display = 'none';
    playerScreen.style.display = 'none';
    gameRoundScreen.style.display = 'flex';
}

// Update player list display (same as before)
function updatePlayerList() {
    if (!playerList) {
        console.warn('⚠️ Player list element not found');
        return;
    }
    
    playerList.innerHTML = '';
    gameState.players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        if (player.isHost) {
            const hostTitle = gameState.gameType === 'truth_tales' ? 'Chief Detective' : 'Host';
            playerElement.innerHTML = `${player.name} <span class="host-tag">(${hostTitle})</span>`;
        } else {
            playerElement.textContent = player.name;
        }
        playerList.appendChild(playerElement);
    });
    
    if (playerCount) {
        playerCount.textContent = gameState.players.length;
    }
}

// Show audience reaction with sound and animation (same as before, but only for Joke Factory)
function showAudienceReaction(reactionData) {
    if (!audienceReaction || gameState.gameType !== 'joke_factory') return;
    
    const reactionMap = {
        'crickets': 'crickets',
        'mild': 'mild-laugh',
        'medium': 'medium-laugh',
        'strong': 'big-laugh',
        'ovation': 'applause'
    };
    
    const reactionType = reactionMap[reactionData.reaction.name] || 'mild-laugh';
    
    audienceReaction.className = 'audience-reaction';
    audienceReaction.innerHTML = '';
    
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
    
    if (typeof soundManager !== 'undefined') {
        soundManager.play(reactionType.replace('-', ''));
    }
    
    setTimeout(() => {
        audienceReaction.classList.remove(reactionType);
    }, 3000);
}

// Display host message (only for Joke Factory)
function displayHostMessage(hostData) {
    if (gameState.gameType !== 'joke_factory') return;
    
    const existingMessages = document.querySelectorAll('.host-message-overlay');
    existingMessages.forEach(msg => {
        if (msg.parentNode) {
            msg.parentNode.removeChild(msg);
        }
    });
    
    const hostMessageOverlay = document.createElement('div');
    hostMessageOverlay.className = 'host-message-overlay';
    hostMessageOverlay.innerHTML = `
        <div class="host-bubble-improved">
            <div class="host-avatar-improved">🎭</div>
            <div class="host-text-improved">${hostData.line}</div>
            <div class="host-close-btn" onclick="this.parentElement.parentElement.remove()">×</div>
        </div>
    `;
    
    document.body.appendChild(hostMessageOverlay);
    
    setTimeout(() => {
        hostMessageOverlay.classList.add('show');
    }, 100);
    
    if (typeof soundManager !== 'undefined') {
        if (hostData.type === 'welcome' || hostData.type === 'finale') {
            soundManager.play('applause', 0.3);
        } else if (hostData.type === 'encouragement') {
            soundManager.play('ding', 0.4);
        } else {
            soundManager.play('ding', 0.2);
        }
    }
    
    setTimeout(() => {
        if (hostMessageOverlay.parentNode) {
            hostMessageOverlay.classList.remove('show');
            setTimeout(() => {
                if (hostMessageOverlay.parentNode) {
                    hostMessageOverlay.parentNode.removeChild(hostMessageOverlay);
                }
            }, 500);
        }
    }, 6000);
}

// Reset round UI (same as before)
function resetRoundUI() {
    if (answerSection) answerSection.style.display = 'block';
    if (votingSection) votingSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (jokeInput) {
        jokeInput.value = '';
        jokeInput.disabled = false;
    }
    if (submitJokeBtn) {
        submitJokeBtn.disabled = false;
        if (gameState.gameType === 'truth_tales') {
            submitJokeBtn.textContent = 'Submit My Shame';
        } else {
            submitJokeBtn.textContent = 'Submit Joke';
        }
    }
    gameState.hasSubmitted = false;
    gameState.hasVoted = false;
}

// Enhanced display round content function (Joke Factory specific)
function displayRoundContent(roundData) {
    if (gameState.gameType !== 'joke_factory') return;
    
    console.log('🎯 DISPLAYING ROUND CONTENT:', roundData);
    
    if (!roundTitle || !roundDescription || !promptDisplay) {
        console.error('❌ Required elements not found!');
        return;
    }
    
    roundTitle.textContent = `Round ${roundData.round}: ${roundData.roundName}`;
    
    switch (roundData.roundType) {
        case 'punchlines':
            roundDescription.textContent = 'Write a setup for the given punchline';
            promptDisplay.innerHTML = `<div class="punchline-display">Punchline: "${roundData.content}"</div>`;
            if (jokeInput) jokeInput.placeholder = 'Write your setup here...';
            break;
        case 'setups':
            roundDescription.textContent = 'Write a punchline for the given setup';
            promptDisplay.innerHTML = `<div class="setup-display">Setup: "${roundData.content}"</div>`;
            if (jokeInput) jokeInput.placeholder = 'Write your punchline here...';
            break;
        case 'topics':
            roundDescription.textContent = 'Write a complete joke about the given topic';
            promptDisplay.innerHTML = `<div class="topic-display">Topic: "${roundData.content}"</div>`;
            if (jokeInput) jokeInput.placeholder = 'Write your complete joke here...';
            break;
    }
    
    promptDisplay.style.display = 'block';
    promptDisplay.style.visibility = 'visible';
    promptDisplay.style.opacity = '1';
    
    const contentElement = promptDisplay.querySelector('.punchline-display, .setup-display, .topic-display');
    if (contentElement) {
        contentElement.style.display = 'block';
        contentElement.style.visibility = 'visible';
        contentElement.style.opacity = '1';
    }
    
    gameState.currentContent = roundData.content;
    gameState.roundPhase = 'writing';
    resetRoundUI();
}

// Display Truth Tales topic
function displayTruthTalesTopic(topic) {
    if (gameState.gameType !== 'truth_tales') return;
    
    if (promptDisplay) {
        promptDisplay.innerHTML = `<div class="topic-display">${topic}</div>`;
        promptDisplay.style.display = 'block';
    }
    
    if (roundTitle) {
        roundTitle.textContent = `Round ${gameState.currentRound} of 3`;
    }
    
    if (roundDescription) {
        roundDescription.textContent = 'Write a TRUE story about this topic!';
    }
    
    if (jokeInput) {
        jokeInput.placeholder = 'Write your embarrassing true story here... Remember, it has to be TRUE!';
    }
}

// Display voting options (same as before)
function displayVotingOptions(submissions) {
    if (!votingOptions) {
        console.error('❌ votingOptions element not found');
        return;
    }
    
    votingOptions.innerHTML = '';
    
    submissions.forEach((submission, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'vote-option';
        optionElement.setAttribute('data-id', submission.id);
        optionElement.textContent = submission.text;
        
        optionElement.addEventListener('click', () => {
            document.querySelectorAll('.vote-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            optionElement.classList.add('selected');
            
            if (!gameState.hasVoted) {
                socket.emit('submitVote', {
                    roomCode: gameState.roomCode,
                    submissionId: submission.id
                });
                gameState.hasVoted = true;
                if (typeof soundManager !== 'undefined') {
                    soundManager.play('ding', 0.4);
                }
            }
        });
        
        votingOptions.appendChild(optionElement);
    });
    
    if (answerSection) answerSection.style.display = 'none';
    if (votingSection) votingSection.style.display = 'block';
    gameState.roundPhase = 'voting';
}

// Display results (same as before)
function displayResults(resultsData) {
    if (!resultsDisplay) {
        console.error('❌ resultsDisplay element not found');
        return;
    }
    
    resultsDisplay.innerHTML = '';
    
    resultsData.results.forEach((result, index) => {
        const resultElement = document.createElement('div');
        resultElement.className = `result-item ${index === 0 ? 'winner' : ''}`;
        
        if (gameState.gameType === 'joke_factory') {
            resultElement.innerHTML = `
                <div class="result-player">${result.playerName}</div>
                <div class="result-submission">"${result.submission}"</div>
                <div class="vote-count">${result.votes} vote${result.votes !== 1 ? 's' : ''}</div>
            `;
        } else if (gameState.gameType === 'truth_tales') {
            resultElement.innerHTML = `
                <div class="result-story">"${result.story}"</div>
                <div class="result-author">Actually written by: ${result.author}</div>
                <div class="guess-list">
                    Correct guesses: ${result.correctGuesses}/${result.totalGuesses}
                    <br>
                    ${result.guesses.map(guess => 
                        `<span class="${guess.correct ? 'correct-guess' : 'wrong-guess'}">
                            ${guess.guesser} guessed: ${guess.guessedAuthor}
                        </span>`
                    ).join('<br>')}
                </div>
            `;
        }
        
        resultsDisplay.appendChild(resultElement);
    });
    
    // Show current scores
    if (resultsData.scores) {
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
    }
    
    if (votingSection) votingSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    gameState.roundPhase = 'results';
}

// Display Truth Tales guessing phase
function displayTruthTalesGuessing(data) {
    if (gameState.gameType !== 'truth_tales') return;
    
    // Hide story writing section
    const storyWritingSection = document.getElementById('story-writing-section');
    if (storyWritingSection) storyWritingSection.style.display = 'none';
    
    // Show guessing section
    const guessingSection = document.getElementById('guessing-section');
    if (guessingSection) guessingSection.style.display = 'block';
    
    const phaseIndicator = document.getElementById('phase-indicator');
    if (phaseIndicator) phaseIndicator.textContent = 'Detective Phase - Make Your Guesses!';
    
    // Display stories for guessing
    const storiesContainer = document.getElementById('stories-to-guess');
    if (storiesContainer) {
        storiesContainer.innerHTML = '';
        
        data.stories.forEach((story, index) => {
            const storyDiv = document.createElement('div');
            storyDiv.className = 'story-item';
            storyDiv.innerHTML = `
                <h4>Story #${index + 1}</h4>
                <p class="result-story">"${story.text}"</p>
                <div class="player-select">
                    <label>Who wrote this?</label>
                    <select class="guess-select" data-story-id="${story.id}">
                        <option value="">Select detective...</option>
                        ${data.players.map(player => `<option value="${player.id}">${player.name}</option>`).join('')}
                    </select>
                </div>
            `;
            storiesContainer.appendChild(storyDiv);
        });
        
        // Show submit button when all guesses are made
        document.querySelectorAll('.guess-select').forEach(select => {
            select.addEventListener('change', checkAllTruthTalesGuesses);
        });
    }
}

function checkAllTruthTalesGuesses() {
    const selects = document.querySelectorAll('.guess-select');
    const allFilled = Array.from(selects).every(select => select.value !== '');
    
    const submitBtn = document.getElementById('submit-guesses-btn');
    if (allFilled && submitBtn) {
        submitBtn.style.display = 'block';
        
        // Prepare guesses
        gameState.currentGuesses = {};
        selects.forEach(select => {
            const storyId = parseInt(select.dataset.storyId);
            const guessedAuthorId = select.value;
            gameState.currentGuesses[storyId] = guessedAuthorId;
        });
    }
}

// Event listeners
if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
        const playerName = prompt('Enter your nickname:');
        if (!playerName || playerName.trim().length < 2) {
            alert('Please enter a valid nickname (at least 2 characters)');
            return;
        }
        
        gameState.playerName = playerName.trim();
        if (playerNameDisplay) playerNameDisplay.textContent = gameState.playerName;
        
        if (typeof soundManager !== 'undefined') {
            soundManager.playSuccess();
        }
        
        // Send game type with room creation
        socket.emit('createRoom', { 
            playerName: gameState.playerName,
            gameType: gameState.gameType
        });
    });
}

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', () => {
        showRoomJoinPage();
    });
}

if (joinGameBtn) {
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
        if (playerNameDisplay) playerNameDisplay.textContent = gameState.playerName;
        
        if (typeof soundManager !== 'undefined') {
            soundManager.playSuccess();
        }
        socket.emit('joinRoom', { roomCode, playerName: gameState.playerName });
    });
}

if (backBtn) {
    backBtn.addEventListener('click', () => {
        showLandingPage();
    });
}

if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
        if (gameState.players.length < 3) {
            alert('Need at least 3 players to start the game');
            return;
        }
        
        if (typeof soundManager !== 'undefined') {
            soundManager.playDrumroll();
        }
        socket.emit('startGame', { roomCode: gameState.roomCode });
    });
}

// Submit joke/answer (unified for both games)
if (submitJokeBtn) {
    submitJokeBtn.addEventListener('click', () => {
        const answer = jokeInput.value.trim();
        if (!answer) {
            alert('Please write something before submitting!');
            return;
        }
        
        if (gameState.hasSubmitted) {
            return;
        }
        
        if (gameState.gameType === 'joke_factory') {
            socket.emit('submitAnswer', {
                roomCode: gameState.roomCode,
                answer: answer
            });
        } else if (gameState.gameType === 'truth_tales') {
            socket.emit('submitStory', {
                roomCode: gameState.roomCode,
                story: answer
            });
        }
        
        if (typeof soundManager !== 'undefined') {
            soundManager.play('ding', 0.5);
        }
    });
}

// Truth Tales specific submit guesses button
const submitGuessesBtn = document.getElementById('submit-guesses-btn');
if (submitGuessesBtn) {
    submitGuessesBtn.addEventListener('click', () => {
        if (gameState.gameType !== 'truth_tales') return;
        
        // Submit all guesses
        Object.entries(gameState.currentGuesses).forEach(([storyId, guessedAuthorId]) => {
            socket.emit('submitGuess', {
                roomCode: gameState.roomCode,
                storyId: parseInt(storyId),
                guessedAuthorId: guessedAuthorId
            });
        });
        
        submitGuessesBtn.disabled = true;
        submitGuessesBtn.textContent = 'Guesses Submitted!';
    });
}

// Socket event listeners - updated for unified server
socket.on('roomCreated', ({ roomCode, isHost, players, gameType }) => {
    gameState.roomCode = roomCode;
    gameState.isHost = isHost;
    gameState.players = players;
    gameState.gameType = gameType || gameState.gameType; // Use server response or fallback
    
    if (roomCodeDisplay) roomCodeDisplay.textContent = roomCode;
    updatePlayerList();
    showHostScreen();
    
    console.log(`${gameType} room created: ${roomCode}`);
});

socket.on('roomJoined', ({ roomCode, isHost, players, gameType }) => {
    gameState.roomCode = roomCode;
    gameState.isHost = isHost;
    gameState.players = players;
    gameState.gameType = gameType || gameState.gameType; // Use server response or fallback
    
    updatePlayerList();
    showPlayerScreen();
    
    console.log(`Joined ${gameType} room: ${roomCode}`);
});

socket.on('playerJoined', ({ players }) => {
    gameState.players = players;
    updatePlayerList();
    if (typeof soundManager !== 'undefined') {
        soundManager.play('ding', 0.3);
    }
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
        if (typeof soundManager !== 'undefined') {
            soundManager.playSuccess();
        }
    }
    
    console.log(`${newHost} is now the host`);
});

// Joke Factory specific events
socket.on('hostSpeaks', (hostData) => {
    displayHostMessage(hostData);
    console.log('Host says:', hostData.line);
});

socket.on('gameStarting', ({ message, totalPlayers }) => {
    gameState.gameStarted = true;
    showGameRoundScreen();
    
    if (audienceReaction && gameState.gameType === 'joke_factory') {
        audienceReaction.innerHTML = '🎉🎭🎉';
        audienceReaction.className = 'audience-reaction applause';
        setTimeout(() => {
            audienceReaction.classList.remove('applause');
        }, 3000);
    }
    
    if (typeof soundManager !== 'undefined') {
        soundManager.play('applause', 0.4);
    }
    alert(message);
    console.log('Game starting with', totalPlayers, 'players');
});

socket.on('roundStarted', (roundData) => {
    console.log('🎯 ROUND STARTED EVENT RECEIVED:', roundData);
    if (gameState.gameType === 'joke_factory') {
        displayRoundContent(roundData);
    }
    if (typeof soundManager !== 'undefined') {
        soundManager.playDrumroll();
    }
    console.log(`Round ${roundData.round} started:`, roundData.roundName);
});

// Truth Tales specific events
socket.on('gameStarted', ({ message, topic, phase }) => {
    if (gameState.gameType !== 'truth_tales') return;
    
    gameState.phase = phase;
    gameState.currentTopic = topic;
    gameState.currentRound = 1;
    
    displayTruthTalesTopic(topic);
    
    const roundNumber = document.getElementById('round-number');
    if (roundNumber) roundNumber.textContent = '1';
    
    const phaseIndicator = document.getElementById('phase-indicator');
    if (phaseIndicator) phaseIndicator.textContent = 'Story Writing Phase';
    
    showGameRoundScreen();
    alert(message);
});

socket.on('storySubmitted', () => {
    console.log('Story submitted successfully!');
});

socket.on('guessingPhase', ({ stories, players }) => {
    if (gameState.gameType !== 'truth_tales') return;
    
    gameState.stories = stories;
    gameState.phase = 'guessing';
    
    displayTruthTalesGuessing({ stories, players });
});

socket.on('nextRound', ({ round, topic, phase }) => {
    if (gameState.gameType !== 'truth_tales') return;
    
    gameState.currentRound = round;
    gameState.currentTopic = topic;
    gameState.phase = phase;
    gameState.hasSubmitted = false;
    
    // Reset UI
    const resultsSection = document.getElementById('results-section');
    const storyWritingSection = document.getElementById('story-writing-section');
    const phaseIndicator = document.getElementById('phase-indicator');
    const roundNumber = document.getElementById('round-number');
    const submissionStatus = document.getElementById('submission-status');
    
    if (resultsSection) resultsSection.style.display = 'none';
    if (storyWritingSection) storyWritingSection.style.display = 'block';
    if (phaseIndicator) phaseIndicator.textContent = 'Story Writing Phase';
    if (roundNumber) roundNumber.textContent = round;
    if (submissionStatus) submissionStatus.textContent = '';
    
    displayTruthTalesTopic(topic);
    
    if (jokeInput) {
        jokeInput.value = '';
        jokeInput.disabled = false;
    }
    if (submitJokeBtn) {
        submitJokeBtn.disabled = false;
        submitJokeBtn.textContent = 'Submit My Shame';
    }
});

// Shared events
socket.on('submissionReceived', () => {
    gameState.hasSubmitted = true;
    if (jokeInput) jokeInput.disabled = true;
    if (submitJokeBtn) {
        submitJokeBtn.disabled = true;
        submitJokeBtn.textContent = gameState.gameType === 'truth_tales' ? 'Story Submitted!' : 'Submitted!';
    }
    
    const submissionStatus = document.getElementById('submission-status');
    if (submissionStatus && gameState.gameType === 'truth_tales') {
        submissionStatus.textContent = 'Your embarrassing truth has been recorded! 📝';
    }
    
    if (typeof soundManager !== 'undefined') {
        soundManager.play('ding', 0.6);
    }
});

socket.on('submissionUpdate', ({ submitted, total }) => {
    console.log(`Submissions: ${submitted}/${total}`);
});

socket.on('votingStarted', ({ submissions, timeLimit }) => {
    if (gameState.gameType === 'joke_factory') {
        displayVotingOptions(submissions);
    }
    if (typeof soundManager !== 'undefined') {
        soundManager.play('drumroll', 0.3);
    }
    console.log('Voting started with', submissions.length, 'submissions');
});

socket.on('voteReceived', () => {
    if (typeof soundManager !== 'undefined') {
        soundManager.play('ding', 0.4);
    }
    console.log('Vote submitted successfully');
});

socket.on('voteUpdate', ({ voted, total }) => {
    console.log(`Votes: ${voted}/${total}`);
});

socket.on('audienceReaction', (reactionData) => {
    showAudienceReaction(reactionData);
    console.log('Audience reaction:', reactionData.reaction.name);
});

socket.on('roundResults', (resultsData) => {
    displayResults(resultsData);
    
    // Play reaction for the winner (Joke Factory only)
    if (gameState.gameType === 'joke_factory' && resultsData.results.length > 0 && typeof soundManager !== 'undefined') {
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
    
    if (typeof soundManager !== 'undefined') {
        soundManager.play('applause');
    }
    if (audienceReaction && gameState.gameType === 'joke_factory') {
        audienceReaction.innerHTML = '🏆👏🎉';
        audienceReaction.className = 'audience-reaction applause';
    }
    
    setTimeout(() => {
        const gameTitle = gameState.gameType === 'truth_tales' ? 'Truth Tales' : 'Joke Factory';
        const winnerTitle = gameState.gameType === 'truth_tales' ? 'Master Detective' : 'Comedy Champion';
        
        alert(`${gameTitle} Over!\n\n${winnerTitle}: ${winner.name} with ${winner.score} points!\n\nFinal Scores:\n${finalScores.map((score, i) => `${i + 1}. ${score.name}: ${score.score} points`).join('\n')}`);
        
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
    if (typeof soundManager !== 'undefined') {
        soundManager.play('crickets', 0.2);
    }
    alert(`Error: ${message}`);
    console.error('Socket error:', message);
});

// Connection status
socket.on('connect', () => {
    console.log('Connected to unified server');
    console.log('Game type detected:', gameState.gameType);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Add click sounds to all buttons
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn') && typeof soundManager !== 'undefined') {
        soundManager.play('ding', 0.3);
    }
});

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM Content Loaded');
    console.log('🎮 Game Type:', gameState.gameType);
    
    const requiredElements = [
        'landing-page', 'room-join-page', 'host-screen', 'player-screen', 'game-round-screen'
    ];
    
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`❌ Required element not found: ${id}`);
        } else {
            console.log(`✅ Found element: ${id}`);
        }
    });
    
    initializeSoundControls();
    showLandingPage();
    console.log(`StandUp Showdown ${gameState.gameType} client loaded successfully!`);
});