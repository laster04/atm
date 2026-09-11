import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/database.js';

export interface InvitedUser {
  id: string;
  email: string;
  name: string;
  /** Set only for accounts created by this invite; existing users keep their password. */
  resetToken: string | null;
  isNewAccount: boolean;
}

/**
 * Resolves the account an invite should attach a manager relation to.
 *
 * An existing account is linked as-is: managing a team and running a league are
 * separate relations, so someone who already has one may be invited to the other
 * without a second account and without touching their password.
 */
export const resolveInvitee = async (email: string, name: string): Promise<InvitedUser> => {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (existing) {
    return { ...existing, resetToken: null, isNewAccount: false };
  }

  const randomPassword = crypto.randomBytes(32).toString('hex');
  const hashedPassword = await bcrypt.hash(randomPassword, 10);
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date();
  resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

  const created = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      active: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      passwordResetToken: resetToken,
      passwordResetTokenExpiresAt: resetTokenExpiry,
    },
    select: { id: true, email: true, name: true },
  });

  return { ...created, resetToken, isNewAccount: true };
};
