# Production Setup Guide

## ✓ App is Running Successfully!

Your built app is now running on **http://localhost:3000**

---

## How to Start the Production App

### Method 1: Using the startup script (RECOMMENDED)

```bash
node start-prod.mjs
```

This script:
- ✓ Loads environment variables from `.env`
- ✓ Connects to MongoDB Atlas (cloud)
- ✓ Starts the server on port 3000

---

### Method 2: Manual startup with environment variables

```bash
export $(cat .env | xargs) && node .output/server/index.mjs
```

---

## Environment Setup

Your `.env` file is correctly configured with:
- ✓ `MONGO_URI` - Azure MongoDB Atlas (cloud database)
- ✓ `JWT_SECRET` - Authentication secret
- ✓ `EMAIL_USER` & `EMAIL_PASS` - Email service
- ✓ `FIREBASE_API_KEY` - Firebase configuration
- ✓ `GOOGLE_AI_API_KEY` - Google AI API
- ✓ `UPSTASH_REDIS_REST_URL` - Redis cache

---

## Accessing the App

Once running, access the app at:
- **URL**: http://localhost:3000
- **Port**: 3000

---

## Stopping the App

Press `Ctrl+C` in the terminal where the app is running.

---

## Troubleshooting

### If MongoDB connection fails:
- Check your internet connection (app uses cloud MongoDB)
- Verify `MONGO_URI` in `.env` is correct
- Check MongoDB Atlas firewall rules allow your IP

### If port 3000 is already in use:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### If environment variables not loading:
- Ensure `.env` file is in the project root (same level as `.output`)
- Use `start-prod.mjs` script instead of running directly

---

## Production Deployment

For production deployment:

1. **Set environment variables** on your hosting platform (Vercel, Railway, etc.)
2. **Run**: `node .output/server/index.mjs`
3. **Port**: The app will listen on the port specified by `PORT` env variable (default: 3000)

---

## Files Structure

```
project-root/
├── .env                    ← Environment variables
├── .output/                ← Built production app
│   ├── server/
│   │   └── index.mjs       ← Server entry point
│   ├── public/
│   └── ...
├── start-prod.mjs          ← Startup script (loads .env)
└── PRODUCTION_SETUP.md     ← This file
```

---

## Quick Start Commands

```bash
# Start the app
node start-prod.mjs

# Check if running
curl http://localhost:3000

# View logs
tail -f /tmp/server.log

# Stop the app
Ctrl+C
```

---

## ✓ Status

- ✓ App built successfully
- ✓ Environment variables configured
- ✓ MongoDB connection ready
- ✓ Server listening on port 3000
- ✓ Ready for production use

