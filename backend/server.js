/**
 * server.js – Opportunity Tracker Backend
 * =========================================
 * Node.js + Express server that:
 *  • Connects to MongoDB (via Mongoose)
 *  • Exposes REST API for opportunities
 *  • Hosts the data ingestion pipeline
 *  • Supports Telegram Bot webhook integration
 *
 * Run: node server.js
 * Port: 5000 (override with PORT env var)
 */

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const dotenv     = require('dotenv');
const path       = require('path');
const apiRoutes  = require('./routes');

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── MIDDLEWARE ─────────────────────────────────────── */
app.use(cors());                             // Allow frontend requests
app.use(express.json());                     // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

/* ── LOGGING MIDDLEWARE ─────────────────────────────── */
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

/* ── MONGODB CONNECTION ─────────────────────────────── */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/opportunitytracker';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected:', MONGO_URI);
  } catch (err) {
    console.warn('⚠️  MongoDB connection failed. Starting local in-memory DB...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✅ In-Memory MongoDB connected at:', uri);
  }
}

/* ── ROUTES ─────────────────────────────────────────── */
app.use('/', apiRoutes);

/* ── SERVE FRONTEND ──────────────────────────────────── */
app.use(express.static(path.join(__dirname, '../frontend')));

/* ── SPA FALLBACK ────────────────────────────────────── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

/* ── HEALTH CHECK ───────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

/* ── 404 HANDLER ────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/* ── GLOBAL ERROR HANDLER ───────────────────────────── */
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

/* ── START ──────────────────────────────────────────── */
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Opportunity Tracker API running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
  });
});
