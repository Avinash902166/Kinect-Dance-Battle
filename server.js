const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for current player names
let playerNames = {
  player1: '',
  player2: '',
  updatedAt: Date.now()
};

// GET /names — Unity polls this endpoint
app.get('/names', (req, res) => {
  res.json(playerNames);
});

// POST /names — iPad submits names here
app.post('/names', (req, res) => {
  const { player1, player2 } = req.body;
  playerNames = {
    player1: (player1 || '').trim(),
    player2: (player2 || '').trim(),
    updatedAt: Date.now()
  };
  console.log(`Names updated → P1: "${playerNames.player1}", P2: "${playerNames.player2}"`);
  res.json({ success: true, names: playerNames });
});

// POST /reset — Reset names (called after game ends)
app.post('/reset', (req, res) => {
  playerNames = { player1: '', player2: '', updatedAt: Date.now() };
  console.log('Player names reset.');
  res.json({ success: true });
});

// Health check for Render
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Kinect Dance Name Server running on port ${PORT}`);
});
