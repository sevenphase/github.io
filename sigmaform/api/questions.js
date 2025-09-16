// Vercel API function for questions - fetches from Google Sheets
import { sessions, SESSION_TIMEOUT } from './login.js';

// Configuration
const QUESTIONS_SHEET_ID = '1rDUy1ZEWj9aYYh_yj2Ml4vI721pMa6XCZ_eftIYLWkM';

// Validate session
function validateSession(sessionId) {
  if (!sessionId) return null;

  try {
    const session = sessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();

    // Check if session has expired
    if (now - session.lastAccess > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
      return null;
    }

    // Update last access time
    session.lastAccess = now;
    sessions.set(sessionId, session);

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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.query.session;

    // Validate session
    const session = validateSession(sessionId);
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