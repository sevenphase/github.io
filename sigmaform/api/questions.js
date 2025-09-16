// Vercel API function for questions - reads session from HttpOnly cookies
import { verifyJWT } from './login.js';

// Configuration
const QUESTIONS_SHEET_ID = '1rDUy1ZEWj9aYYh_yj2Ml4vI721pMa6XCZ_eftIYLWkM';

// Parse cookies from request headers
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}

// Validate session from HttpOnly cookie
function validateSessionFromCookie(req) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies.sessionId;

    if (!sessionToken) {
      console.log('No sessionId cookie found');
      return null;
    }

    // Verify JWT token
    const session = verifyJWT(sessionToken);
    if (!session) {
      console.log('Invalid or expired JWT session');
      return null;
    }

    console.log('Valid session for user:', session.userInfo?.name);
    return session;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

// Fetch questions from Google Sheets
async function fetchQuestionsFromSheets() {
  try {
    // Use Google Sheets public CSV export
    const url = `https://docs.google.com/spreadsheets/d/${QUESTIONS_SHEET_ID}/export?format=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch from Google Sheets: ${response.status}`);
    }

    const csvData = await response.text();
    return csvData;
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Enable CORS with credentials for cookies
  res.setHeader('Access-Control-Allow-Origin', 'https://sevenphase.net');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate session from HttpOnly cookie
    const session = validateSessionFromCookie(req);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Fetch questions from Google Sheets
    console.log('Fetching questions from Google Sheets...');
    const questionsData = await fetchQuestionsFromSheets();

    // Return questions as CSV (same format as your Apps Script)
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(questionsData);

  } catch (error) {
    console.error('Questions error:', error);
    return res.status(500).json({ error: `Failed to load questions: ${error.message}` });
  }
}