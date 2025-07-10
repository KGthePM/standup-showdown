// Sound Manager for StandUp Showdown
// Add this to your public/scripts/ directory as soundManager.js

class SoundManager {
    constructor() {
        this.sounds = {};
        this.isEnabled = true;
        this.volume = 0.7;
        this.loadSounds();
    }

    // Load all sound files
    loadSounds() {
        const soundFiles = {
            crickets: 'sounds/crickets.mp3',
            mildLaugh: 'sounds/mild-laugh.mp3',
            mediumLaugh: 'sounds/medium-laugh.mp3',
            bigLaugh: 'sounds/big-laugh.mp3',
            applause: 'sounds/applause.mp3',
            drumroll: 'sounds/drumroll.mp3',
            ding: 'sounds/ding.mp3'
        };

        // Load each sound file
        for (const [name, path] of Object.entries(soundFiles)) {
            this.sounds[name] = new Audio(path);
            this.sounds[name].volume = this.volume;
            
            // Handle loading errors gracefully
            this.sounds[name].onerror = () => {
                console.warn(`Failed to load sound: ${path}`);
            };
        }
    }

    // Play a specific sound
    play(soundName, volume = null) {
        if (!this.isEnabled) return;
        
        const sound = this.sounds[soundName];
        if (!sound) {
            console.warn(`Sound not found: ${soundName}`);
            return;
        }

        // Reset the sound to beginning and play
        sound.currentTime = 0;
        if (volume !== null) {
            sound.volume = Math.max(0, Math.min(1, volume));
        }
        
        const playPromise = sound.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn('Sound play failed:', error);
            });
        }
    }

    // Play audience reaction based on vote percentage
    playAudienceReaction(votePercentage, totalVotes) {
        // No votes = crickets
        if (totalVotes === 0) {
            this.play('crickets');
            return 'crickets';
        }

        // Determine reaction level based on vote percentage
        if (votePercentage >= 80) {
            this.play('applause');
            return 'applause';
        } else if (votePercentage >= 60) {
            this.play('bigLaugh');
            return 'big-laugh';
        } else if (votePercentage >= 40) {
            this.play('mediumLaugh');
            return 'medium-laugh';
        } else if (votePercentage >= 20) {
            this.play('mildLaugh');
            return 'mild-laugh';
        } else {
            this.play('crickets');
            return 'crickets';
        }
    }

    // Play drumroll for anticipation
    playDrumroll() {
        this.play('drumroll');
    }

    // Play success sound
    playSuccess() {
        this.play('ding');
    }

    // Stop all sounds
    stopAll() {
        Object.values(this.sounds).forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }

    // Toggle sound on/off
    toggleSound() {
        this.isEnabled = !this.isEnabled;
        if (!this.isEnabled) {
            this.stopAll();
        }
        return this.isEnabled;
    }

    // Set volume for all sounds
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }

    // Preload sounds (call this when game starts)
    preloadSounds() {
        Object.values(this.sounds).forEach(sound => {
            sound.load();
        });
    }
}

// Create global sound manager instance
const soundManager = new SoundManager();