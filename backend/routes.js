/**
 * routes.js – API Route Handlers
 * ================================
 * GET  /opportunities        → List all opportunities (with optional filters)
 * POST /opportunity          → Add a new opportunity (triggers pipeline)
 * GET  /opportunity/:id      → Get a single opportunity by ID
 * POST /telegram/webhook     → Receive messages from Telegram Bot API
 * GET  /pipeline/run-sample  → Seed the DB with sample data
 */

const express    = require('express');
const router     = express.Router();
const Opportunity = require('../database/schema');
const pipeline   = require('./pipeline');

const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const User       = require('../database/userSchema');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_for_jwt_opportunity_tracker';

/* ─────────────────────────────────────────────────── */
/*  POST /auth/register                                */
/*  Register a new user with email and password        */
/* ─────────────────────────────────────────────────── */
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword
    });
    await newUser.save();

    const token = jwt.sign({ userId: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { name: newUser.name, email: newUser.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────── */
/*  POST /auth/login                                   */
/*  Login with email and password                      */
/* ─────────────────────────────────────────────────── */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────── */
/*  GET /opportunities                                  */
/*  Returns all stored opportunities, newest first.    */
/*  Supports query params: source, role, daysLeft      */
/* ─────────────────────────────────────────────────── */
router.get('/opportunities', async (req, res) => {
  try {
    const filter = {};

    // Optional filters via query string
    if (req.query.source)   filter.source = req.query.source;
    if (req.query.role)     filter.role   = new RegExp(req.query.role, 'i');

    // Filter by deadline within N days
    if (req.query.daysLeft) {
      const n = parseInt(req.query.daysLeft);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + n);
      filter.deadline = { $lte: futureDate.toISOString().split('T')[0] };
    }

    const opportunities = await Opportunity.find(filter).sort({ postedDate: -1 });
    res.json(opportunities);
  } catch (err) {
    console.error('GET /opportunities error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────── */
/*  POST /opportunity                                   */
/*  Adds a new opportunity after running it through    */
/*  the data pipeline (extraction + validation).       */
/* ─────────────────────────────────────────────────── */
router.post('/opportunity', async (req, res) => {
  try {
    // Run through pipeline (validates & normalizes)
    const processed = pipeline.process(req.body);

    // Duplicate detection: same company + role + deadline
    const existing = await Opportunity.findOne({
      company:  new RegExp(`^${processed.company}$`, 'i'),
      role:     new RegExp(`^${processed.role}$`, 'i'),
      deadline: processed.deadline
    });

    if (existing) {
      return res.status(409).json({
        message: 'Opportunity already exists',
        existing
      });
    }

    const opp = new Opportunity(processed);
    await opp.save();
    res.status(201).json(opp);
  } catch (err) {
    console.error('POST /opportunity error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────── */
/*  GET /opportunity/:id                               */
/*  Returns a single opportunity by its MongoDB ID.   */
/* ─────────────────────────────────────────────────── */
router.get('/opportunity/:id', async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
    res.json(opp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────── */
/*  POST /telegram/webhook                             */
/*  Receives Telegram Bot updates (messages).          */
/*  Configure this URL in BotFather as your webhook.  */
/* ─────────────────────────────────────────────────── */
router.post('/telegram/webhook', async (req, res) => {
  // Acknowledge Telegram immediately (within 10 s)
  res.sendStatus(200);

  try {
    const update = req.body;

    // We only care about channel_post or message updates
    const message = update.channel_post || update.message;
    if (!message || !message.text) return;

    const rawText = message.text;
    console.log('📱 Telegram message received:', rawText.substring(0, 100));

    // Run through the data pipeline
    const processed = pipeline.processFromTelegram(rawText);
    if (!processed) {
      console.log('   ↳ Pipeline: Not an opportunity message, skipping.');
      return;
    }

    // Duplicate check
    const existing = await Opportunity.findOne({
      company:  new RegExp(`^${processed.company}$`, 'i'),
      role:     new RegExp(`^${processed.role}$`, 'i'),
      deadline: processed.deadline
    });

    if (!existing) {
      const opp = new Opportunity(processed);
      await opp.save();
      console.log('   ✅ Saved from Telegram:', processed.company, '–', processed.role);
    } else {
      console.log('   ↳ Duplicate, skipped.');
    }
  } catch (err) {
    console.error('Telegram webhook error:', err.message);
  }
});

/* ─────────────────────────────────────────────────── */
/*  GET /pipeline/run-sample                           */
/*  Seeds the database with 8 sample opportunities.   */
/*  Call once to populate an empty database.           */
/* ─────────────────────────────────────────────────── */
router.get('/pipeline/run-sample', async (req, res) => {
  const SAMPLE = [
    { company: 'Google',    role: 'Software Engineer Intern',  eligibility: 'B.Tech (CS/IT), 7.5+ CGPA',       deadline: '2026-03-25', source: 'Website',  applyLink: 'https://careers.google.com/',      description: 'Work on large-scale distributed systems and search infrastructure.', postedDate: '2026-03-01' },
    { company: 'Microsoft', role: 'Product Design Intern',     eligibility: 'Any stream, 3rd or 4th year',     deadline: '2026-03-18', source: 'Telegram', applyLink: 'https://careers.microsoft.com/',   description: 'Contribute to Teams, Azure, or Xbox design challenges.',             postedDate: '2026-03-05' },
    { company: 'Amazon',    role: 'Data Science Intern',       eligibility: 'M.Tech / B.Tech (DS, CS), 7+ CGPA', deadline: '2026-04-05', source: 'Telegram', applyLink: 'https://www.amazon.jobs/',         description: 'Alexa AI / AWS ML teams. Paid 3-month internship.',                  postedDate: '2026-03-03' },
    { company: 'Flipkart',  role: 'Backend Engineer Intern',   eligibility: 'B.Tech (CS/ECE), 8+ CGPA',        deadline: '2026-03-30', source: 'Website',  applyLink: 'https://www.flipkartcareers.com/', description: 'Microservices at scale handling millions of orders per day.',        postedDate: '2026-03-07' },
    { company: 'Swiggy',    role: 'UI/UX Design Intern',       eligibility: 'Any stream, portfolio required',  deadline: '2026-04-10', source: 'Manual',   applyLink: 'https://careers.swiggy.com/',      description: 'Design screens for the Swiggy ordering app.',                       postedDate: '2026-03-10' },
    { company: 'ISRO',      role: 'Research Intern',           eligibility: 'B.Tech (ECE/Mech/CS), 8.5+ CGPA', deadline: '2026-03-20', source: 'Website',  applyLink: 'https://www.isro.gov.in/internship', description: 'Satellite communications, launch vehicles, or AI remote sensing.',  postedDate: '2026-02-28' },
    { company: 'Zomato',    role: 'ML Engineer Intern',        eligibility: 'B.Tech / M.Tech (CS/AI/DS), 7+ CGPA', deadline: '2026-04-15', source: 'Telegram', applyLink: 'https://www.zomato.com/careers', description: 'Recommendation engines, ETA prediction and fraud detection.',      postedDate: '2026-03-08' },
    { company: 'Infosys',   role: 'DevOps Intern',             eligibility: 'B.Tech (any stream), 60%+',       deadline: '2026-03-22', source: 'Website',  applyLink: 'https://www.infosys.com/careers/', description: 'Kubernetes, Docker, CI/CD and cloud infrastructure.',              postedDate: '2026-03-02' }
  ];

  try {
    let inserted = 0;
    for (const s of SAMPLE) {
      const exists = await Opportunity.findOne({ company: s.company, role: s.role });
      if (!exists) {
        await new Opportunity(s).save();
        inserted++;
      }
    }
    res.json({ message: `Seeded ${inserted} new sample opportunities.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
