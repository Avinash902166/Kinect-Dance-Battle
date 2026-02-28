const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── MongoDB (optional) ──────────────────────────────────────────────────────
let Session;
if (process.env.MONGODB_URI) {
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err));

  const sessionSchema = new mongoose.Schema({
    player1: { name: String, score: Number },
    player2: { name: String, score: Number },
    winner: { name: String, score: Number },
    createdAt: { type: Date, default: Date.now }
  });
  Session = mongoose.model('Session', sessionSchema);
}

// ─── In-memory state ─────────────────────────────────────────────────────────
let playerNames = { player1: '', player2: '', updatedAt: Date.now() };

let currentSession = {
  scores: { player1: null, player2: null },  // null = not submitted yet
  result: null,   // { winner: {name,score}, player1:{name,score}, player2:{name,score} }
  sessionId: Date.now()
};

// ─── Player Names ─────────────────────────────────────────────────────────────
app.get('/names', (req, res) => res.json(playerNames));

app.post('/names', (req, res) => {
  const { player1, player2 } = req.body;
  playerNames = {
    player1: (player1 || '').trim(),
    player2: (player2 || '').trim(),
    updatedAt: Date.now()
  };
  console.log(`Names → P1:"${playerNames.player1}" P2:"${playerNames.player2}"`);
  res.json({ success: true, names: playerNames });
});

// ─── Score Submission ─────────────────────────────────────────────────────────
// POST /submit-score
// Body: { playerIndex: 0|1, name: "Alice", score: 1234 }
let resetTimer = null;

app.post('/submit-score', async (req, res) => {
  const { playerIndex, name, score } = req.body;

  if (playerIndex !== 0 && playerIndex !== 1) {
    return res.status(400).json({ error: 'playerIndex must be 0 or 1' });
  }

  const playerKey = playerIndex === 0 ? 'player1' : 'player2';
  currentSession.scores[playerKey] = { name: name || `Player ${playerIndex + 1}`, score: Number(score) || 0 };

  console.log(`Score received — ${playerKey}: "${name}" = ${score}`);

  // Check if both scores are in
  if (currentSession.scores.player1 !== null && currentSession.scores.player2 !== null) {
    const p1 = currentSession.scores.player1;
    const p2 = currentSession.scores.player2;
    const winner = p1.score >= p2.score ? p1 : p2;

    currentSession.result = { winner, player1: p1, player2: p2 };

    console.log(`Winner: "${winner.name}" with score ${winner.score}`);

    // Save to MongoDB if connected
    if (Session) {
      try {
        await new Session({
          player1: { name: p1.name, score: p1.score },
          player2: { name: p2.name, score: p2.score },
          winner: { name: winner.name, score: winner.score }
        }).save();
        console.log('Session saved to MongoDB.');
      } catch (err) {
        console.error('MongoDB save error:', err.message);
      }
    }

    // Auto-reset session and names after 15s (gives both devices time to poll the result)
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      playerNames = { player1: '', player2: '', updatedAt: Date.now() };
      currentSession = {
        scores: { player1: null, player2: null },
        result: null,
        sessionId: Date.now()
      };
      resetTimer = null;
      console.log('Session auto-reset after result (names and scores cleared).');
    }, 15000);
  }

  res.json({
    success: true,
    received: playerKey,
    bothSubmitted: currentSession.result !== null,
    result: currentSession.result
  });
});

// ─── Get Result ───────────────────────────────────────────────────────────────
// GET /result — Unity polls this until result is available
app.get('/result', (req, res) => {
  res.json({
    ready: currentSession.result !== null,
    result: currentSession.result,
    sessionId: currentSession.sessionId
  });
});

// ─── Reset ────────────────────────────────────────────────────────────────────
app.post('/reset', (req, res) => {
  playerNames = { player1: '', player2: '', updatedAt: Date.now() };
  currentSession = {
    scores: { player1: null, player2: null },
    result: null,
    sessionId: Date.now()
  };
  console.log('Session reset.');
  res.json({ success: true });
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kinect Dance Name Server running on port ${PORT}`));
