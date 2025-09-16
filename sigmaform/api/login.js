// Vercel API function for login - HttpOnly cookies with JWT
const crypto = require('crypto');

// Configuration
const CLIENT_ID = '141726088289-7rvc4j711ac0ospiiuam4bdmuklahsbe.apps.googleusercontent.com';
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

// Secret for JWT signing (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'sigmaform-jwt-secret-change-in-production';

// Simple JWT implementation for stateless sessions
function createJWT(payload) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Date.now();
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_TIMEOUT
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

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

export default async function handler(req, res) {
  // Enable CORS with credentials for cookies
  res.setHeader('Access-Control-Allow-Origin', 'https://sevenphase.net');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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

    // Create stateless JWT session
    const sessionToken = createJWT({
      userId: payload.sub,
      userInfo: userInfo
    });

    // Set HttpOnly cookie with security flags for cross-origin
    const cookieOptions = [
      `sessionId=${sessionToken}`,
      'HttpOnly',
      'Secure',
      'SameSite=None', // Allow cross-site cookies for sevenphase.net -> vercel.app
      `Max-Age=${Math.floor(SESSION_TIMEOUT / 1000)}`, // Convert to seconds
      'Path=/'
    ].join('; ');

    res.setHeader('Set-Cookie', cookieOptions);

    const response = {
      success: true,
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

// JWT verification function for other API endpoints
function verifyJWT(token) {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Check expiration
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Export for other functions
export { verifyJWT };