# Railway Deployment Guide - Campulse Backend

## 🚀 What You'll Get

```
✅ NestJS backend running 24/7
✅ PostgreSQL database hosted
✅ Auto-deploys on git push
✅ Free SSL/HTTPS
✅ ~$15-20/month when you graduate
✅ Easy scaling
```

---

## 📋 Step 1: Sign Up & Connect GitHub

1. Go to: https://railway.app
2. Click **"Start Project"**
3. Sign up with GitHub (recommended)
4. Authorize GitHub access
5. Choose account (your personal)

---

## 🔧 Step 2: Create Railway Project

### Option A: From Dashboard (Easiest)

1. Click **"New Project"**
2. Select **"Deploy from GitHub"**
3. Choose your Campulse repository
4. Select `apps/api` as root directory
5. Railway auto-detects it's a NestJS app

### Option B: From CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to project
cd /c/PROJECTS/Campulse

# Initialize Railway
railway init

# Name it: campulse-api
# Select GitHub deployment
```

---

## 🗄️ Step 3: Add PostgreSQL Database

### In Railway Dashboard:

1. Go to your project
2. Click **"+ New"** (top right)
3. Select **"Database"** → **"PostgreSQL"**
4. Railway creates database automatically
5. Connection string auto-added to environment variables

---

## ⚙️ Step 4: Set Environment Variables

### In Railway Dashboard:

1. Go to **Variables** tab
2. Railway auto-adds: `DATABASE_URL`
3. Add additional variables:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
```

**Important:** 
- Change `JWT_SECRET` to something random: 
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Copy the output and paste as JWT_SECRET

---

## 📦 Step 5: Configure `apps/api/package.json`

Ensure these scripts exist:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "dev": "nest start --watch",
    "lint": "eslint src"
  },
  "engines": {
    "node": "18.x"
  }
}
```

**Railway needs:**
- `build` script (compiles TypeScript)
- `start` script (runs the app)
- `engines.node` (specifies Node version)

---

## 🔄 Step 6: Deploy Database Schema

Before deploying, your database needs the schema.

### Option A: Using Prisma from Railway

1. In Railway, click **PostgreSQL** service
2. Go to **Connect** tab
3. Copy the connection string
4. Locally:

```bash
cd apps/api

# Set DATABASE_URL
export DATABASE_URL="postgresql://..." # Paste from Railway

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### Option B: Using Railway Shell

1. In Railway dashboard, click **PostgreSQL**
2. Click **Shell** tab
3. Paste your Prisma schema migrations

---

## 🚀 Step 7: Deploy

### Method 1: Automatic (Recommended)

```bash
# Just push to GitHub main branch
git add .
git commit -m "Deploy to Railway"
git push origin main

# Railway watches and auto-deploys
# Check logs in dashboard
```

### Method 2: Manual Deploy

```bash
# Using Railway CLI
cd /c/PROJECTS/Campulse

railway up
```

---

## ✅ Step 8: Verify Deployment

### Check Logs

1. Railway Dashboard → Your project → `api` service
2. Click **Logs** tab
3. Should see:
```
[NestFactory] Starting Nest application...
✓ Nest application successfully started on port 3001
```

### Test Endpoint

Railway gives you a URL like: `https://campulse-api-prod.railway.app`

Test it:
```bash
curl https://campulse-api-prod.railway.app/health

# Should return: { "status": "ok" }
```

---

## 🔗 Step 9: Connect Frontend to Backend

### In `apps/web/lib/api-client.ts` (create if needed):

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = {
  async fetchUser(id: string) {
    const res = await fetch(`${API_BASE_URL}/users/${id}`);
    return res.json();
  },
  
  async loginUser(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  }
};
```

### In `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://campulse-api-prod.railway.app
```

---

## 🔐 Security Checklist

- [ ] Change `JWT_SECRET` to random value
- [ ] Set `NODE_ENV=production`
- [ ] Enable CORS in NestJS:

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: ['https://campulse-web.netlify.app'], // Your frontend URL
    credentials: true
  });
  
  await app.listen(process.env.PORT || 3001);
}
bootstrap();
```

- [ ] Disable debug mode in production
- [ ] Use environment variables for secrets (not in code)

---

## 📊 Step 10: Monitor Deployment

### Railroad Dashboard Shows:

- **Deployments**: Every git push
- **Logs**: Real-time server output
- **Metrics**: CPU, memory, requests/sec
- **Database**: Connected PostgreSQL stats

### Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| **Build fails** | Check `npm run build` works locally |
| **Missing DATABASE_URL** | Railway auto-adds, check Variables tab |
| **Port issues** | Use `process.env.PORT` or default 3001 |
| **Module not found** | Ensure `npm install` includes deps |
| **Prisma errors** | Run `prisma migrate deploy` before push |

---

## 🎯 Your Deployment URLs

After deployment, Railway gives you:

```
Backend API: https://campulse-api-prod.railway.app
Database: Managed by Railway (hidden, use connection string)
Frontend: Will deploy to Netlify separately
```

---

## 💰 Pricing After Graduation

```
NestJS Backend:     ~$5-10/month
PostgreSQL Database: ~$5-10/month
─────────────────────────────────
Total:              ~$15-20/month

(Currently free while using GitHub Student Pack credits)
```

---

## 🔄 Continuous Deployment

**Now every time you:**
```bash
git push origin main
```

**Railway automatically:**
1. ✅ Pulls latest code
2. ✅ Runs `npm install`
3. ✅ Runs `npm run build`
4. ✅ Runs database migrations (if needed)
5. ✅ Starts `npm start`
6. ✅ Routes traffic to new version

**No manual deployment needed!** 🚀

---

## 📋 Final Checklist

- [ ] GitHub Student Pack claimed (free credits)
- [ ] Railway account created
- [ ] NestJS project connected
- [ ] PostgreSQL database created
- [ ] Environment variables set (DATABASE_URL, JWT_SECRET, NODE_ENV)
- [ ] Prisma migrations deployed
- [ ] First push to GitHub triggers deploy
- [ ] Backend URL shows in Railway dashboard
- [ ] API responds to requests
- [ ] Frontend connects to backend URL
- [ ] CORS configured for frontend domain

---

## 🚀 You're Now Production-Ready!

```
Campulse Architecture:
├─ Frontend: Netlify (Next.js)
├─ Backend: Railway (NestJS)
├─ Database: Railway PostgreSQL
└─ Domain: Namecheap (custom domain)

Cost: $0 while student → $15-20/month after
```

Your app is now accessible 24/7 from anywhere! 🎉

---

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- NestJS Deployment: https://docs.nestjs.com/deployment
- Troubleshooting: Check Railway logs dashboard

**Let me know if you hit any issues during deployment!** 🚀
