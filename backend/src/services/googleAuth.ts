import { OAuth2Client } from 'google-auth-library';

/** What a verified Google sign-in tells us about the person. */
export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string;
}

/** The OAuth client id the app's Google button is issued for; none turns the button off. */
export const googleClientId = (): string | null => process.env.GOOGLE_CLIENT_ID || null;

let client: OAuth2Client | null = null;

/**
 * Checks the ID token Google's button handed the browser: signed by Google,
 * issued for our client id, not expired, and for an address Google has
 * verified. Anything else yields null, never an identity.
 */
export const verifyGoogleCredential = async (credential: string): Promise<GoogleIdentity | null> => {
  const clientId = googleClientId();
  if (!clientId) return null;
  client ??= new OAuth2Client(clientId);
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) return null;
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
    };
  } catch {
    return null;
  }
};
