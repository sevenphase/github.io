# Google Apps Script for SigmaForm Math Quiz

This directory contains the Google Apps Script code needed to securely access Google Sheets data for the math quiz application.

## Files

- `Code.gs` - Main Apps Script code with the `doGet()` function
- `appsscript.json` - Apps Script manifest and configuration
- `sigmaform` - Original script file (can be deleted after deployment)

## Deployment Instructions

### Option 1: Manual Deployment (Simplest)

#### 1. Create New Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Delete the default `Code.gs` content
4. Copy and paste the content from `Code.gs` in this directory

### Option 2: API-Based Deployment (Recommended for Developers)

#### 1. Install Google Apps Script API

```bash
# Install the Google Apps Script API client
npm install googleapis
# or
pip install google-api-python-client
```

#### 2. Set Up Authentication

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Apps Script API
4. Create a service account and download the JSON key file
5. Share your Google Apps Script project with the service account email

#### 3. Deploy Using API

```javascript
// Example using Node.js
const { google } = require('googleapis');
const fs = require('fs');

async function deployScript() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'path/to/service-account-key.json',
    scopes: ['https://www.googleapis.com/auth/script.projects']
  });

  const script = google.script({ version: 'v1', auth });
  
  // Create new project
  const project = await script.projects.create({
    requestBody: {
      title: 'SigmaForm Quiz Backend'
    }
  });

  // Upload code files
  const codeContent = fs.readFileSync('appscript/Code.gs', 'utf8');
  const manifestContent = fs.readFileSync('appscript/appsscript.json', 'utf8');

  await script.projects.updateContent({
    scriptId: project.data.scriptId,
    requestBody: {
      files: [
        {
          name: 'Code',
          type: 'SERVER_JS',
          source: codeContent
        },
        {
          name: 'appsscript',
          type: 'JSON',
          source: manifestContent
        }
      ]
    }
  });

  // Deploy as web app
  const deployment = await script.projects.deployments.create({
    scriptId: project.data.scriptId,
    requestBody: {
      versionNumber: 1,
      manifestFileName: 'appsscript.json',
      description: 'SigmaForm Quiz Backend v1'
    }
  });

  console.log('Deployment URL:', deployment.data.deploymentConfig.scriptId);
}
```

#### 4. Automated Deployment Script

Create a `deploy.sh` script for easy deployment:

```bash
#!/bin/bash
# Deploy SigmaForm Apps Script

echo "🚀 Deploying SigmaForm Apps Script..."

# Check if service account key exists
if [ ! -f "service-account-key.json" ]; then
    echo "❌ Service account key not found. Please download from Google Cloud Console."
    exit 1
fi

# Deploy using Node.js script
node deploy-script.js

echo "✅ Deployment complete!"
echo "📝 Update your frontend with the new Web App URL"
```

### 2. Configure Project Settings

1. Click on the project name (top left) and rename it to "SigmaForm Quiz Backend"
2. Click on the gear icon (Project Settings)
3. Set the timezone to your preferred timezone
4. Save the settings

### 3. Deploy as Web App

1. Click "Deploy" → "New deployment"
2. Choose "Web app" as the type
3. Set the following options:
   - **Execute as**: Me (your Google account)
   - **Who has access**: Anyone
4. Click "Deploy"
5. Click "Authorize access" and grant necessary permissions
6. Copy the Web App URL that's generated

### 4. Update Frontend

1. Replace the hardcoded Apps Script URL in `index.html` with your new Web App URL
2. The URL should look like: `https://script.google.com/macros/s/[SCRIPT_ID]/exec`

### 5. Test the Deployment

1. Open your Web App URL in a browser
2. You should see CSV data from your spreadsheet
3. If you see an error, check the Apps Script logs for debugging

## Security Notes

- The script is configured to allow "Anyone" access, which is necessary for the frontend to work
- No sensitive credentials are exposed in the client-side code
- The script only reads data from the specified spreadsheet

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure the script is deployed as a Web App with "Anyone" access
2. **Spreadsheet Not Found**: Verify the spreadsheet ID and sharing permissions
3. **Permission Denied**: Ensure the Google account running the script has access to the spreadsheet

### Testing Locally:

Use the `testLocal()` function in the Apps Script editor to test the script before deployment.

## Future Enhancements

- Add support for multiple quiz types via URL parameters
- Implement quiz metadata endpoints
- Add caching for better performance
- Implement rate limiting if needed
