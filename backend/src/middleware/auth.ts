import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { AuthRequest, JwtPayload } from '../types/index.js';
import { Role } from '@prisma/client';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    } catch (error) {
      const name = (error as Error)?.name;
      if (name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      if (name === 'JsonWebTokenError' || name === 'NotBeforeError') {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, onboardingCompletedAt: true, teamTourCompletedAt: true }
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    // Anything past token verification is a server-side failure (e.g. database
    // errors). Returning 401 here logs the client out for a problem it cannot fix.
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, role: true }
      });

      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Token invalid, continue without user
  }
  next();
};
