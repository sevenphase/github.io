// Vercel API function for answer validation - fetches from Google Sheets
import { sessions, SESSION_TIMEOUT } from './login.js';

// Configuration
const ANSWERS_SHEET_ID = '1hjVAVJHmZQcsWl1ZHi2Xu_9FJiSNNTAogF7lhEMVn8o';

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

// Fetch answers from Google Sheets
async function fetchAnswersFromSheets() {
  try {
    // Use Google Sheets public CSV export
    const url = `https://docs.google.com/spreadsheets/d/${ANSWERS_SHEET_ID}/export?format=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch answers from Google Sheets: ${response.status}`);
    }

    const csvData = await response.text();
    return csvData;
  } catch (error) {
    console.error('Error fetching answers from Google Sheets:', error);
    throw error;
  }
}

// Parse CSV data to find answer for specific question
function parseAnswersCSV(csvData, questionNumber) {
  const lines = csvData.split('\n');

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle quoted fields)
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    // Check if this is the question we're looking for
    const qNum = fields[0]?.replace(/"/g, '');
    if (qNum == questionNumber) {
      return {
        correctAnswer: fields[1]?.replace(/"/g, ''),
        points: parseInt(fields[2]?.replace(/"/g, '')) || 1,
        notes: fields[3]?.replace(/"/g, '') || ''
      };
    }
  }

  return null;
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
    const { sessionId, questionNumber, userAnswer } = req.body;

    // Validate session
    const session = validateSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!questionNumber || userAnswer === undefined) {
      return res.status(400).json({ error: 'Missing questionNumber or userAnswer' });
    }

    // Fetch answers from Google Sheets
    console.log(`Validating answer for question ${questionNumber}...`);
    const answersData = await fetchAnswersFromSheets();

    // Find the correct answer for this question
    const answerInfo = parseAnswersCSV(answersData, questionNumber);

    if (!answerInfo) {
      throw new Error(`Question ${questionNumber} not found in answers sheet`);
    }

    // Normalize answers for comparison (case-insensitive, trim whitespace)
    const normalizedUserAnswer = String(userAnswer).trim().toLowerCase();
    const normalizedCorrectAnswer = String(answerInfo.correctAnswer).trim().toLowerCase();

    // Check if answer is correct
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    // Prepare response (never expose correct answers in response)
    const response = {
      correct: isCorrect,
      questionNumber: questionNumber,
      userAnswer: userAnswer,
      points: isCorrect ? answerInfo.points : 0,
      notes: isCorrect ? answerInfo.notes : '',
      timestamp: new Date().toISOString()
    };

    console.log(`Answer validation result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('Answer validation error:', error);
    return res.status(500).json({ error: `Answer validation failed: ${error.message}` });
  }
}