# 🚀 Opportunity Tracker

A full-stack student dashboard that automatically collects, organises, and displays internship and job opportunity notifications from **Telegram, websites, and manual input** — no more digging through hundreds of messages.

---

## 📁 Project Structure

```
opportunity-tracker/
├── frontend/
│   ├── index.html      ← Single-page application (5 views)
│   ├── styles.css      ← Dark glassmorphism theme, fully responsive
│   └── script.js       ← SPA router, API calls, Telegram parser, calendar
├── backend/
│   ├── server.js       ← Express server + MongoDB connection
│   ├── routes.js       ← REST API endpoints
│   └── pipeline.js     ← 6-step data pipeline (ingest → parse → extract → store)
├── database/
│   └── schema.js       ← Mongoose schema for opportunities collection
├── package.json
└── .env.example        ← Environment variables template
```

---

## ⚡ Quick Start (VS Code)

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [MongoDB Community](https://www.mongodb.com/try/download/community) (local) **OR** a MongoDB Atlas URI

### Step 1 – Clone / Open the project
Open the `opportunity-tracker/` folder in VS Code.

### Step 2 – Set up environment
```bash
# Copy the example env file
copy .env.example .env
```
Edit `.env` and update `MONGO_URI` if needed (default connects to local MongoDB).

### Step 3 – Install dependencies
```bash
npm install
```

### Step 4 – Start the backend
```bash
# Development mode (auto-restarts on changes)
npm run dev

# OR production mode
npm start
```
You should see:
```
🚀 Opportunity Tracker API running at http://localhost:5000
✅ MongoDB connected: mongodb://127.0.0.1:27017/opportunitytracker
```

### Step 5 – Seed sample data (optional, first run)
Visit in your browser or use curl/Postman:
```
http://localhost:5000/pipeline/run-sample
```
This inserts 8 sample opportunities into MongoDB.

### Step 6 – Open the frontend
Open `frontend/index.html` directly in your browser  
**OR** use the VS Code Live Server extension:
> Right-click `index.html` → **Open with Live Server**

> 💡 **No backend? No problem!** The frontend auto-falls back to built-in sample data when the backend is offline.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/opportunities` | List all opportunities |
| `GET` | `/opportunities?source=Telegram` | Filter by source |
| `GET` | `/opportunities?daysLeft=7` | Deadlines within 7 days |
| `POST` | `/opportunity` | Add a new opportunity |
| `GET` | `/opportunity/:id` | Get one opportunity by ID |
| `POST` | `/telegram/webhook` | Telegram Bot webhook receiver |
| `GET` | `/pipeline/run-sample` | Seed DB with sample data |
| `GET` | `/health` | Health check |

### POST /opportunity – Request Body
```json
{
  "company": "Google",
  "role": "Software Engineer Intern",
  "eligibility": "B.Tech (CS/IT), 7.5+ CGPA",
  "deadline": "2026-03-25",
  "description": "Work on large-scale distributed systems.",
  "applyLink": "https://careers.google.com/",
  "source": "Telegram"
}
```

---

## 📱 Telegram Bot Integration

### Setup
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a bot → copy the **token**
3. Add token to `.env` → `TELEGRAM_BOT_TOKEN=your_token_here`

### Set Webhook (replace with your public URL)
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-domain.com/telegram/webhook"
```

### Local Testing with ngrok
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 5000

# Then set webhook to:
# https://xxxx.ngrok-free.app/telegram/webhook
```

### How it works
When a message arrives in a monitored Telegram channel:
1. Telegram sends the message to your webhook URL
2. `pipeline.processFromTelegram()` extracts company, role, eligibility, deadline, link
3. Duplicate check runs (same company + role + deadline = skip)
4. Structured opportunity is saved to MongoDB
5. It appears on the dashboard automatically

---

## 🔧 Data Pipeline

```
Raw Text Input
      │
      ▼
[1] Ingestion      ← Accept from API / Telegram webhook / form
      │
      ▼
[2] Text Parsing   ← Clean emoji, whitespace, non-ASCII
      │
      ▼
[3] Field Extract  ← Regex-based company, role, eligibility, deadline, link
      │
      ▼
[4] Validation     ← Check required fields, detect if it's an opportunity
      │
      ▼
[5] Normalise      ← Standardise date format, validate URLs
      │
      ▼
[6] Store → MongoDB opportunities collection
```

---

## 🎨 Frontend Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Stats, recent cards, upcoming deadlines |
| **Opportunities List** | All opportunities with source filter chips |
| **Search & Filter** | Full-text search + role/source/eligibility/deadline filters |
| **Deadlines Calendar** | Monthly view with deadline dots, click to see details |
| **Add Opportunity** | Manual form + Telegram message simulator |
| **Modal Detail View** | Full opportunity details on card click |
| **Offline Fallback** | 8 sample opportunities shown when backend is down |
| **Responsive** | Works on mobile, tablet, and desktop |
| **Dark Theme** | Glassmorphism dark UI |

---

## 🗄️ MongoDB Schema

Collection: `opportunities`

| Field | Type | Description |
|-------|------|-------------|
| `company` | String (required) | Hiring company name |
| `role` | String (required) | Job/internship title |
| `eligibility` | String | Who can apply |
| `deadline` | String `YYYY-MM-DD` (required) | Application close date |
| `description` | String | Full description / original message |
| `applyLink` | String | URL to apply |
| `source` | Enum: Telegram/Website/Manual/Email/WhatsApp | Origin channel |
| `postedDate` | String `YYYY-MM-DD` | Date ingested |
| `createdAt` | Date | Auto (mongoose timestamps) |
| `updatedAt` | Date | Auto (mongoose timestamps) |

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript (ES2022+) |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Fonts | Inter (Google Fonts) |
| Icons | Font Awesome 6 |
| Bot Integration | Telegram Bot API |

---

## 🚀 Deploying

### Backend (Railway / Render / Fly.io)
1. Push to GitHub
2. Connect repo to Railway/Render
3. Set `MONGO_URI` and `PORT` in environment variables
4. Deploy

### Frontend (Vercel / Netlify / GitHub Pages)
Update `API_BASE` in `frontend/script.js` to your deployed backend URL, then deploy the `frontend/` folder.
