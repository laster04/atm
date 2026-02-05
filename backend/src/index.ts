import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import leagueRoutes from './routes/leagues.js';
import seasonRoutes from './routes/seasons.js';
import teamRoutes from './routes/teams.js';
import playerRoutes from './routes/players.js';
import gameRoutes from './routes/games.js';
import gameStatisticRoutes from './routes/gameStatistics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - set CORS_ORIGIN to a comma-separated list of allowed origins
// e.g. CORS_ORIGIN=http://www.example.com,https://www.example.com
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : null;

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    // If no allowed origins configured, allow all
    if (!allowedOrigins) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/seasons', seasonRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/game-statistics', gameStatisticRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
