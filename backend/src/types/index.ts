import { Request } from 'express';
import { User, Role } from '@prisma/client';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface JwtPayload {
  userId: number;
}
