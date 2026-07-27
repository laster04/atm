# Deployment Guide

This guide covers deploying the Sport Season Scheduling app with:
- **Frontend**: Static hosting via FTP (shared hosting)
- **Backend**: Node.js hosting service (Railway, Render, Fly.io, etc.)

## Prerequisites

- Node.js 18+ installed locally
- FTP client (FileZilla, Cyberduck, or similar)
- Account on a Node.js hosting service

---

## Part 1: Backend Deployment

The backend needs a Node.js hosting service. Here are recommended options:

| Service | Free Tier | Notes |
|---------|-----------|-------|
| [Railway](https://railway.app) | $5 credit/month | Easy PostgreSQL addon |
| [Render](https://render.com) | 750 hours/month | Free PostgreSQL |
| [Fly.io](https://fly.io) | Generous free tier | Requires CLI |

### Step 1: Prepare the Backend

1. Create a production database (PostgreSQL) on your chosen platform

2. Set these environment variables on your hosting platform:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname?schema=public
   JWT_SECRET=<generate-a-strong-random-string>
   PORT=3001
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

   **Important**: Set `CORS_ORIGIN` to your frontend domain for security.

### Step 2: Deploy to Railway (Example)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will detect it's a Node.js app
6. Add a PostgreSQL database service
7. Set the environment variables (Railway auto-sets DATABASE_URL for the PostgreSQL addon)
8. Set the root directory to `backend` in settings
9. The start command should be: `npm run build && npm start`

### Step 3: Run Migrations

After deployment, run migrations via Railway's CLI or dashboard:
```bash
npx prisma migrate deploy
npx prisma db seed  # Optional: seed initial data
```

### Step 4: Note Your Backend URL

Your backend will be available at something like:
- Railway: `https://your-app.up.railway.app`
- Render: `https://your-app.onrender.com`

---

## Part 2: Frontend Deployment (FTP)

### Step 1: Configure the API URL

Edit `frontend/.env.production` and set your backend URL:
```
VITE_API_URL=https://your-backend-url.up.railway.app/api
```

### Step 2: Build the Frontend

```bash
cd frontend
npm install
npm run build
```

This creates a `dist/` folder with all static files.

### Step 3: Upload via FTP

1. Connect to your hosting via FTP (use credentials from your hosting provider)
2. Navigate to the public directory (usually `public_html/` or `www/`)
3. Upload **all contents** of the `frontend/dist/` folder:
   ```
   dist/
   ├── assets/
   │   ├── index-xxxxx.js
   │   └── index-xxxxx.css
   ├── index.html
   ├── vite.svg
   └── .htaccess
   ```
4. Make sure `.htaccess` is uploaded (it may be hidden by default)

### Step 4: Verify Deployment

1. Visit your domain
2. Try navigating to different routes (e.g., `/seasons`) and refreshing
3. If refresh causes 404, verify `.htaccess` was uploaded correctly
4. Check browser console for API connection errors

---

## Troubleshooting

### Frontend Issues

**404 on page refresh**
- Ensure `.htaccess` is uploaded to the root
- Verify `mod_rewrite` is enabled on your hosting

**API connection failed**
- Check `VITE_API_URL` is correct in `.env.production`
- Verify backend is running and accessible
- Check browser console for CORS errors

**CORS errors**
- Set `CORS_ORIGIN` on backend to your frontend domain
- Make sure the URL matches exactly (including https://)

### Backend Issues

**Database connection failed**
- Verify `DATABASE_URL` is correct
- Check if database service is running
- Ensure SSL mode if required: `?sslmode=require`

**Build fails**
- Run `npm run build` locally first to check for errors
- Ensure all dependencies are in `package.json` (not just devDependencies for production)

---

## Security Checklist

- [ ] Change `JWT_SECRET` to a strong random string (32+ characters)
- [ ] Set `CORS_ORIGIN` to your exact frontend domain
- [ ] Use HTTPS for both frontend and backend
- [ ] Don't commit `.env` files to git
- [ ] Remove any test/seed data from production database

---

## Updating the App

### Frontend Update
1. Make changes locally
2. Run `npm run build` in frontend/
3. Upload new `dist/` contents via FTP (overwrite existing)

### Backend Update
1. Push changes to GitHub
2. Railway/Render will auto-deploy from the main branch
3. Run any new migrations if schema changed
