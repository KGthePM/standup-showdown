# 🎭 StandUp Showdown - Comedy Party Game Platform

> **Where Comedy Meets Competition!**

StandUp Showdown has evolved from a single comedy game into a comprehensive **multi-game comedy platform** featuring different types of humor-based party games that bring friends together through laughter, creativity, and hilarious revelations.

## 🎮 Game Portfolio

### 🎤 **Joke Factory** *(Original Game)*
**The Creative Comedy Challenge**
- **Concept**: Players create setups, punchlines, and full jokes with virtual host guidance
- **Rounds**: 3 structured comedy rounds (Setup Battle, Punchline Challenge, Full Joke Creation)
- **Players**: 3-6 players
- **Duration**: 15-20 minutes
- **Social Risk**: Low (creative fiction)
- **Best For**: Creative minds, safe comedy fun

### 🕵️ **Truth Tales** *(New Addition)*
**The Embarrassing Story Detective Game**
- **Concept**: Share embarrassing true stories anonymously, then guess whose story belongs to whom
- **Rounds**: 3-5 rounds with escalating embarrassment
- **Players**: 3-8 players (more chaos with larger groups!)
- **Duration**: 20-30 minutes
- **Social Risk**: High (personal revelations)
- **Best For**: Close friends ready for TMI moments

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Web browser (Chrome, Firefox, Safari, Edge)

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/standup-showdown.git
cd standup-showdown

# Install dependencies
npm install
```

### Starting the Platform

#### Option 1: One-Command Startup (Recommended)
```bash
# Start both games automatically
./start.sh
```

#### Option 2: Manual Startup
```bash
# Terminal 1: Start Joke Factory
node server.js

# Terminal 2: Start Truth Tales
cd games/truth-tales
node server.js
```

### Playing the Games
1. **Game Hub**: Open `index.html` in your browser to choose a game
2. **Direct Access**:
   - 🎤 Joke Factory: http://localhost:3000
   - 🕵️ Truth Tales: http://localhost:3002

## 🎯 Game Comparison

| Feature | Joke Factory 🎤 | Truth Tales 🕵️ |
|---------|----------------|----------------|
| **Core Mechanic** | Creative writing | Detective guessing |
| **Content Type** | Fictional jokes | True personal stories |
| **Scoring** | Audience voting | Deduction accuracy |
| **Social Impact** | Showcase creativity | Reveal embarrassing truths |
| **Friendship Risk** | ✅ Low | ⚠️ High (TMI potential) |
| **Players** | 3-6 | 3-8 |
| **Replayability** | High (endless prompts) | High (personal stories) |

## 🎪 Features

### Shared Platform Features
- **🎨 Professional UI**: Responsive design that works on desktop and mobile
- **🔊 Sound System**: Applause, laughter, crickets, and reaction sounds
- **🏠 Room System**: 4-letter codes for easy joining
- **📱 Mobile-First**: Optimized for phones as controllers
- **⚡ Real-Time**: Instant updates via WebSocket connections
- **🎭 Virtual Host**: Interactive comedy host with personality (Joke Factory)

### Joke Factory Unique Features
- **3 Comedy Rounds**: Setup Battle → Punchline Challenge → Full Joke Creation
- **Curated Content**: 500+ professional comedy prompts
- **Audience Reactions**: Animated reactions based on vote percentages
- **Host Commentary**: Dynamic comedy host with contextual jokes
- **Creative Scoring**: Points for votes + bonus achievements

### Truth Tales Unique Features
- **Anonymous Submissions**: Stories shuffled server-side for mystery
- **Detective Theme**: Purple/pink UI distinct from Joke Factory
- **Strategic Scoring**: Points for correct guesses + misdirection bonuses
- **Escalating Topics**: From mild embarrassment to major TMI
- **Master Detective**: Special recognition for best detectives

## 🎮 How to Play

### 🎤 Joke Factory Gameplay
1. **Host creates room** and shares 4-letter code
2. **Players join** using the code on their phones
3. **Round 1 - Setup Battle**: Write setups for given punchlines
4. **Round 2 - Punchline Challenge**: Complete setups with punchlines  
5. **Round 3 - Full Joke Creation**: Write complete jokes about topics
6. **Vote & Win**: Players vote for funniest submissions each round

### 🕵️ Truth Tales Gameplay
1. **Detective creates room** and shares code
2. **Players join** (3-8 detectives recommended)
3. **Story Phase**: Everyone writes TRUE embarrassing stories anonymously
4. **Detective Phase**: Read all stories and guess who wrote each one
5. **Revelation Phase**: Authors revealed with "OMG that was YOU?!" moments
6. **Scoring**: Points for correct guesses + fooling others
7. **Repeat** for 3-5 rounds of escalating embarrassment

## 🛠️ Technical Architecture

### Multi-Game Platform Structure
```
standup-showdown/
├── index.html                 # Game selector hub
├── server.js                  # Joke Factory server (port 3000)
├── content.js                 # Comedy content database
├── public/                    # Joke Factory frontend
│   ├── index.html
│   ├── scripts/
│   │   ├── client.js
│   │   └── soundManager.js
│   ├── styles/main.css
│   └── sounds/               # Audio files
├── games/
│   └── truth-tales/          # Truth Tales game (port 3002)
│       ├── server.js
│       └── public/index.html
├── start.sh                  # One-command startup script
└── package.json
```

### Technology Stack
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Real-time**: WebSocket connections for multiplayer
- **Audio**: Web Audio API with sound manager
- **Architecture**: Independent microservices per game

## 🎨 Content & Customization

### Joke Factory Content Categories
- **Setup Battle**: 100+ professional punchlines
- **Punchline Challenge**: 100+ comedy setups
- **Full Joke Creation**: 100+ joke topics
- **Styles**: Mark Normand, Anthony Jeselnik, Joey Diaz, Tim Dillon inspired

### Truth Tales Topic Categories
- 💔 Dating Disasters
- 👶 Childhood Chaos  
- 💼 Work Fails
- 📱 Social Media Shame
- ✈️ Travel Nightmares
- 👨‍👩‍👧‍👦 Family Fiascos
- 👗 Fashion Failures
- 💻 Tech Troubles

## 🏆 Scoring Systems

### Joke Factory Scoring
- **Base Points**: +1 per vote received
- **Bonus Points**: +2 for unanimous votes
- **Achievements**: "Crowd Pleaser", "Crickets Club"

### Truth Tales Scoring  
- **Correct Detective Work**: +2 points per correct guess
- **Misdirection Master**: +1 point per wrong guess about your story
- **Perfect Stealth**: +3 bonus if nobody guesses your story

## 🎵 Sound Design

### Audio Features
- **Audience Reactions**: Crickets, mild laugh, big laugh, applause
- **Game Sounds**: Drumroll, success dings, submission confirmations
- **Volume Control**: Adjustable volume and mute toggle
- **Smart Reactions**: Context-aware sound selection

### Sound Files Required
```
public/sounds/
├── crickets.mp3
├── mild-laugh.mp3  
├── medium-laugh.mp3
├── big-laugh.mp3
├── applause.mp3
├── drumroll.mp3
└── ding.mp3
```

## 📱 Mobile Experience

### Responsive Design
- **Mobile-First**: Optimized for phone screens
- **Touch-Friendly**: Large buttons and easy navigation
- **Portrait Mode**: Designed for vertical phone use
- **Host Display**: Large screen shows game state for all players

### Recommended Setup
- **Host**: Large screen (TV, laptop, projector) for shared viewing
- **Players**: Individual phones for private input and voting
- **Audio**: Good speakers for reaction sounds and host commentary

## 🔧 Development & Customization

### Adding New Content
```javascript
// In content.js - Add new joke prompts
punchlines: [
    "...your new punchline here.",
    // Add more punchlines
],

// In Truth Tales server.js - Add new topics
const STORY_TOPICS = [
    "Your new embarrassing topic",
    // Add more topics
];
```

### Creating New Games
The platform is designed for easy expansion:
1. Create new folder in `games/`
2. Follow the existing server.js pattern
3. Use Socket.io for real-time multiplayer
4. Add entry to main hub index.html

## 🚀 Deployment

### Local Development
```bash
npm start          # Start Joke Factory only
npm run start-all  # Start both games (via start.sh)
```

### Production Deployment
- Both games can be deployed independently
- Use environment variables for ports:
  - `PORT` for Joke Factory (default: 3000)
  - `TRUTH_TALES_PORT` for Truth Tales (default: 3002)
- Consider using PM2 for process management
- Add reverse proxy (nginx) for domain routing

## 🎯 Future Roadmap

### Planned Features
- **🎮 Game 3**: "Roast Battle" - Players write roasts for each other
- **🎮 Game 4**: "Caption This" - Funny photo captioning competition  
- **🎮 Game 5**: "Story Builder" - Collaborative story creation
- **🏆 Cross-Game Stats**: Player statistics across all games
- **🎥 Recording**: Save and share highlight moments
- **📱 Mobile App**: Native iOS/Android versions

### Platform Enhancements
- **🔗 Game Transitions**: Seamless switching between games
- **👥 Persistent Lobbies**: Keep groups together across games
- **🏅 Achievement System**: Unlock badges across all games
- **🎨 Themes**: Customizable visual themes per game

## 🤝 Contributing

We welcome contributions! Whether you want to:
- 🎭 Add new comedy content
- 🐛 Fix bugs or improve performance  
- 🎮 Create entirely new games
- 🎨 Improve UI/UX design
- 📱 Enhance mobile experience

### Development Setup
```bash
git clone https://github.com/yourusername/standup-showdown.git
cd standup-showdown
npm install
npm run dev  # Start with nodemon for auto-restart
```

## 📄 License

MIT License - Feel free to use this for your own comedy nights!

## 🎉 Credits

- **Original Concept**: Comedy party game for friends
- **Game Design**: Balanced creative vs. personal humor approaches
- **Technical Architecture**: Scalable multi-game platform
- **Sound Design**: Contextual audio reactions
- **Content Curation**: Inspired by professional comedians

---

## 🎭 Ready to Make People Laugh?

1. **Clone the repo**
2. **Run `./start.sh`** 
3. **Open `index.html`**
4. **Choose your comedy adventure!**

*Whether you want to showcase your creative joke-writing skills or reveal embarrassing truths about your friends, StandUp Showdown has the perfect game for your group!*

**🚀 Now get out there and make some comedy magic happen!**
