import { Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import emailService from '../services/emailService.js';
import {
  AuthRequest,
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
  CreateUserRequest,
  UpdateUserRequest,
  GetUsersQuery,
  UserFilters,
} from '../types/index.js';

const generateActivationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

const getActivationTokenExpiry = (): Date => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24); // 24 hours
  return expiry;
};

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body as RegisterRequest;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const activationToken = generateActivationToken();

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'VIEWER',
        emailVerified: false,
        activationToken,
        activationTokenExpiresAt: getActivationTokenExpiry(),
      },
      select: { id: true, email: true, name: true, role: true, emailVerified: true }
    });

    // Send activation email (don't wait for it to complete)
    emailService.sendActivationEmail(email, name, activationToken).catch((err) => {
      console.error('Failed to send activation email:', err);
    });

    res.status(201).json({
      message: 'Registration successful. Please check your email to activate your account.',
      user,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({ error: 'Please verify your email before logging in' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: 'Your account has been deactivated' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const activateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ error: 'Activation token is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { activationToken: token }
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid activation token' });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: 'Account is already activated' });
      return;
    }

    if (user.activationTokenExpiresAt && user.activationTokenExpiresAt < new Date()) {
      res.status(400).json({ error: 'Activation token has expired. Please request a new one.' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        activationToken: null,
        activationTokenExpiresAt: null,
      }
    });

    // Send welcome email
    emailService.sendWelcomeEmail(user.email, user.name).catch((err) => {
      console.error('Failed to send welcome email:', err);
    });

    res.json({ message: 'Account activated successfully. You can now log in.' });
  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ error: 'Account activation failed' });
  }
};

export const resendActivationEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal if user exists
      res.json({ message: 'If an account exists with this email, an activation link will be sent.' });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: 'Account is already activated' });
      return;
    }

    const activationToken = generateActivationToken();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        activationToken,
        activationTokenExpiresAt: getActivationTokenExpiry(),
      }
    });

    await emailService.sendActivationEmail(email, user.name, activationToken);

    res.json({ message: 'If an account exists with this email, an activation link will be sent.' });
  } catch (error) {
    console.error('Resend activation error:', error);
    res.status(500).json({ error: 'Failed to resend activation email' });
  }
};

const generatePasswordResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

const getPasswordResetTokenExpiry = (): Date => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 1); // 1 hour
  return expiry;
};

export const requestPasswordReset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If an account exists with this email, a password reset link will be sent.' });
      return;
    }

    const resetToken = generatePasswordResetToken();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: getPasswordResetTokenExpiry(),
      }
    });

    await emailService.sendPasswordResetEmail(email, user.name, resetToken);

    res.json({ message: 'If an account exists with this email, a password reset link will be sent.' });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

export const resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Reset token is required' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'New password is required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token }
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    if (user.passwordResetTokenExpiresAt && user.passwordResetTokenExpiresAt < new Date()) {
      res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      }
    });

    // Send confirmation email
    emailService.sendPasswordChangedEmail(user.email, user.name).catch((err) => {
      console.error('Failed to send password changed email:', err);
    });

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, password } = req.body as UpdateProfileRequest;
    const updateData: { name?: string; password?: string } = {};

    if (name) updateData.name = name;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true }
    });

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, name, active } = req.query as GetUsersQuery;
    const where: UserFilters = {};

    if (role) {
      where.role = role as UserFilters['role'];
    }
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    if (active !== undefined) {
      where.active = active === 'true';
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, active: true, emailVerified: true },
      orderBy: { name: 'asc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, active, sendActivationEmail } = req.body as CreateUserRequest & { sendActivationEmail?: boolean };

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Admin-created users are verified by default, unless sendActivationEmail is true
    const shouldSendActivation = sendActivationEmail === true;
    const activationToken = shouldSendActivation ? generateActivationToken() : null;

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'VIEWER',
        active: active ?? true,
        emailVerified: !shouldSendActivation,
        emailVerifiedAt: !shouldSendActivation ? new Date() : null,
        activationToken,
        activationTokenExpiresAt: shouldSendActivation ? getActivationTokenExpiry() : null,
      },
      select: { id: true, email: true, name: true, role: true, active: true, emailVerified: true }
    });

    if (shouldSendActivation && activationToken) {
      emailService.sendActivationEmail(email, name, activationToken).catch((err) => {
        console.error('Failed to send activation email:', err);
      });
    }

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, password, name, role, active } = req.body as UpdateUserRequest;

    const existingUser = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
    }

    const updateData: { email?: string; password?: string; name?: string; role?: UpdateUserRequest['role']; active?: boolean } = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (typeof active === 'boolean') updateData.active = active;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, active: true }
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Prevent self-deletion
    if (req.user!.id === userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
