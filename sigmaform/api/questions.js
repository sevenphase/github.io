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

// Get Google OAuth2 access token using service account
async function getGoogleAccessToken() {
  try {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (!serviceAccountEmail || !privateKey || !projectId) {
      throw new Error('Missing Google Service Account environment variables');
    }

    // Create JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    // Sign JWT using private key
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payloadB64}`);
    const signature = sign.sign(privateKey, 'base64url');

    const jwt = `${header}.${payloadB64}.${signature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting Google access token:', error);
    throw error;
  }
}

// Fetch questions from Google Sheets using API
async function fetchQuestionsFromSheets() {
  try {
    const accessToken = await getGoogleAccessToken();

    // Use Google Sheets API to get all values from first sheet
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${QUESTIONS_SHEET_ID}/values/A:Z`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch from Google Sheets API: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error('Error fetching questions from Google Sheets:', error);
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

    // Fetch questions from Google Sheets API
    console.log('Fetching questions from Google Sheets API...');
    const sheetsData = await fetchQuestionsFromSheets();

    // Convert 2D array to structured objects
    if (!sheetsData || sheetsData.length === 0) {
      throw new Error('No data received from Google Sheets');
    }

    const headers = sheetsData[0]; // First row contains headers
    const questions = [];

    // Process each data row (skip header row)
    for (let i = 1; i < sheetsData.length; i++) {
      const row = sheetsData[i];
      if (!row || row.length === 0) continue;

      const question = {
        questionNumber: parseInt(row[0]) || i,
        question: row[1]?.trim() || '',
        topic: row[2]?.trim() || '',
        answerType: row[3]?.trim() || 'Short Answer',
        options: row[4]?.trim() || ''
      };

      // Parse multiple choice options into choices array
      if (question.answerType === 'Multiple Choice' && question.options) {
        // Parse options like "A) 9; B) 12; C) 17; D) 51" into individual choices
        const choiceMatches = question.options.match(/[A-D]\)[^;]+/g);
        if (choiceMatches) {
          question.choices = choiceMatches.map(choice => choice.substring(3).trim());
        } else {
          // Fallback: split by semicolon and clean up
          question.choices = question.options.split(';').map(choice => choice.trim()).filter(choice => choice.length > 0);
        }
      }

      questions.push(question);
    }

    console.log(`Processed ${questions.length} questions from Sheets API`);

    // Return structured JSON
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ questions });

  } catch (error) {
    console.error('Questions error:', error);
    return res.status(500).json({ error: `Failed to load questions: ${error.message}` });
  }
}