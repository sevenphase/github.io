// Vercel API function for login
const crypto = require('crypto');

// Configuration - move to environment variables
const CLIENT_ID = '141726088289-7rvc4j711ac0ospiiuam4bdmuklahsbe.apps.googleusercontent.com';
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

// In-memory session storage (use Redis/DB for production)
const sessions = new Map();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastAccess > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
    }
  }
}, 30 * 60 * 1000); // Clean every 30 minutes

// Validate Google JWT token
async function validateGoogleToken(token) {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();

    // Verify the token is for our client
    if (payload.aud !== CLIENT_ID) {
      console.error('Token audience mismatch');
      return null;
    }

    // Verify token hasn't expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('Token expired');
      return null;
    }

    // Verify issuer
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      console.error('Invalid token issuer');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

// Create session
function createSession(userId, userInfo) {
  const sessionId = crypto.randomUUID();
  const sessionData = {
    userId: userId,
    userInfo: userInfo,
    createdAt: Date.now(),
    lastAccess: Date.now()
  };

  sessions.set(sessionId, sessionData);
  return sessionId;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing Google token' });
    }

    // Validate Google token server-side
    console.log('Validating Google token...');
    const payload = await validateGoogleToken(token);

    if (!payload) {
      console.log('Token validation failed');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Create user info object (minimal data)
    const userInfo = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };

    // Create secure session
    const sessionId = createSession(payload.sub, userInfo);

    const response = {
      success: true,
      sessionId: sessionId,
      user: userInfo,
      timestamp: new Date().toISOString()
    };

    console.log('Login successful for:', userInfo.name);
    return res.status(200).json(response);

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: `Login failed: ${error.message}` });
  }
}

// Export session management for other functions
export { sessions, SESSION_TIMEOUT };