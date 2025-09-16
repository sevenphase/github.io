// Vercel API function for logout - clears HttpOnly cookies

export default async function handler(req, res) {
  // Enable CORS with credentials for cookies
  res.setHeader('Access-Control-Allow-Origin', 'https://sevenphase.net');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Clear the HttpOnly cookie by setting it with an expired date
    const clearCookieOptions = [
      'sessionId=',
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Max-Age=0', // Expire immediately
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT', // Set to past date
      'Path=/'
    ].join('; ');

    res.setHeader('Set-Cookie', clearCookieOptions);

    console.log('HttpOnly session cookie cleared');

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: `Logout failed: ${error.message}` });
  }
}