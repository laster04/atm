import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import leagueRoutes from './routes/leagues.js';
import seasonRoutes from './routes/seasons.js';
import teamRoutes from './routes/teams.js';
import playerRoutes from './routes/players.js';
import gameRoutes from './routes/games.js';
import gameStatisticRoutes from './routes/gameStatistics.js';

const app = express();

// CORS configuration - set CORS_ORIGIN in production to your frontend domain
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
};
app.use(cors(corsOptions));
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

export default app;
