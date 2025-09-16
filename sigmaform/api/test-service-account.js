// Debug service account configuration
export default async function handler(req, res) {
  try {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    const debug = {
      hasEmail: !!serviceAccountEmail,
      email: serviceAccountEmail,
      hasPrivateKey: !!privateKey,
      privateKeyStart: privateKey ? privateKey.substring(0, 30) + '...' : 'missing',
      projectId: projectId,
      timestamp: new Date().toISOString()
    };

    console.log('Service Account Debug:', debug);

    return res.status(200).json(debug);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}