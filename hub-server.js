const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files for the hub (landing page, shared assets)
app.use(express.static(path.join(__dirname, 'hub')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));

// Serve the main landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'hub', 'index.html'));
});

// Proxy to Joke Factory (your original game)
// For now, we'll serve it from the current location
app.use('/joke-factory', express.static(path.join(__dirname, 'public')));
app.get('/joke-factory/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Proxy to Truth Tales
app.use('/truth-tales', createProxyMiddleware({
    target: 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: {
        '^/truth-tales': ''
    },
    onError: (err, req, res) => {
        console.error('Truth Tales proxy error:', err.message);
        res.status(503).send(`
            <h1>Truth Tales Unavailable</h1>
            <p>Make sure Truth Tales server is running on port 3002</p>
            <p>Run: <code>cd games/truth-tales && node server.js</code></p>
            <a href="/">← Back to Game Hub</a>
        `);
    }
}));

// API endpoint for game discovery
app.get('/api/games', (req, res) => {
    res.json([
        {
            id: 'joke-factory',
            name: 'Joke Factory',
            description: 'The original comedy battle! Create setups, punchlines, and full jokes.',
            status: 'available',
            path: '/joke-factory/',
            players: '3-6',
            rounds: 3,
            duration: '15-20 minutes',
            theme: 'Creative Comedy Writing',
            icon: '🎤'
        },
        {
            id: 'truth-tales',
            name: 'Truth Tales',
            description: 'Share embarrassing true stories anonymously, then guess whose story belongs to whom!',
            status: 'available',
            path: '/truth-tales/',
            players: '3-8',
            rounds: '3-5',
            duration: '20-30 minutes',
            theme: 'Detective Story Guessing',
            icon: '🕵️'
        }
    ]);
});

// Health check endpoints
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        games: {
            'joke-factory': 'integrated',
            'truth-tales': 'proxy to :3002'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">← Back to Game Hub</a>
    `);
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Hub server error:', err);
    res.status(500).send(`
        <h1>Server Error</h1>
        <p>Something went wrong on our end.</p>
        <a href="/">← Back to Game Hub</a>
    `);
});

app.listen(PORT, () => {
    console.log(`🎭 StandUp Showdown Hub running on port ${PORT}`);
    console.log(`🌐 Main Hub: http://localhost:${PORT}`);
    console.log(`🎤 Joke Factory: http://localhost:${PORT}/joke-factory/`);
    console.log(`🕵️ Truth Tales: http://localhost:${PORT}/truth-tales/`);
    console.log(`\n📋 Instructions:`);
    console.log(`1. Keep this hub server running`);
    console.log(`2. Start Truth Tales: cd games/truth-tales && node server.js`);
    console.log(`3. Visit http://localhost:${PORT} to see the game selection!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🎭 StandUp Showdown Hub shutting down...');
    process.exit(0);
});