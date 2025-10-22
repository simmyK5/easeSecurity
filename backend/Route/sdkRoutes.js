// backend/src/routes/sdkRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { analyzeAudio } = require("../Socket/analyzeAudio"); // adjust path
const Developer = require("../Model/developer");
const mkdirp = require('mkdirp');
// import { compareHash } from '../src/utils/hash'; // Or use your local utility

// TODO: replace with real DB lookup for developer by apiKey
async function findDeveloperByKey(apiKey) {
  // Example structure returned: { id, email, webhook, quotaLeft }
  // For now, accept any apiKey and return null webhook
  return { id: 'dev_test', email: 'dev@example.com', webhook: null, quotaLeft: 50 };
}

router.get('/quota', async (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey) return res.status(401).json({ error: 'Missing API key' });
  const dev = await findDeveloperByKey(apiKey);
  if (!dev) return res.status(403).json({ error: 'Invalid API key' });
  res.json({ quotaLeft: dev.quotaLeft ?? 0 });
});


async function validateApiKey(apiKey, email) {
    if (!apiKey || !email) return false;

    try {
        const dev = await Developer.findOne({ email: email });

        console.log("getting dev by email", dev);

        
        if (!dev) {
            return false;
        }

        let isMatch=false;
        if(apiKey==dev.clientSecretHash){
          isMatch=true;
        }
       

        // Returns true only if BOTH the email was found AND the keys match
        return isMatch; 

    } catch (error) {
        console.error("Error during API key validation:", error);
        return false;
    }
}


// Helper: save raw stream to file
function saveStreamToFile(req, filePath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);
    writeStream.on("finish", () => resolve(filePath));
    writeStream.on("error", reject);
  });
}

// POST /incidents
router.post("/incidents", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing Authorization header" });

    const [scheme, token] = authHeader.split(" ");
    console.log("token",token)
    if (!await validateApiKey(token,"simtest@gmail.com")) {
      return res.status(403).json({ error: "Invalid API key" });
    }

    const tempDir = path.join(__dirname, "../../tmp/sdk");
    await mkdirp(tempDir);

    const tempFilePath = path.join(tempDir, `sdk_audio_${Date.now()}.wav`);

    if (req.headers['content-type']?.includes('application/json')) {
      // JSON with base64 audio
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const payload = JSON.parse(body);
        if (!payload.audioDataBase64) return res.status(400).json({ error: "audioDataBase64 required" });

        fs.writeFileSync(tempFilePath, Buffer.from(payload.audioDataBase64, 'base64'));
        const result = await analyzeAudio(tempFilePath);
        fs.unlinkSync(tempFilePath);
        res.json({ ok: true, result });
      });
    } else {
      // Raw stream or multipart
      await saveStreamToFile(req, tempFilePath);
      const result = await analyzeAudio(tempFilePath);
      fs.unlinkSync(tempFilePath);
      res.json({ ok: true, result });
    }
  } catch (err) {
    console.error("SDK /incidents error:", err);
    res.status(500).json({ error: "internal_error" });
  }
})

/*router.post('/incidents', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) return res.status(401).json({ error: 'Missing API key' });
    const dev = await findDeveloperByKey(apiKey);
    if (!dev) return res.status(403).json({ error: 'Invalid API key' });

    const payload = req.body || {};
    // Small validation
    if (!payload.userEmail) return res.status(400).json({ error: 'userEmail required' });

    // If audioBase64 present, save file temporarily
    let savedPath = null;
    if (payload.audioDataBase64) {
      const uploads = path.join(__dirname, '../../uploads/sdk');
      if (!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
      const fileName = `${Date.now()}_${payload.userEmail.replace(/[@.]/g, '_')}.wav`;
      savedPath = path.join(uploads, fileName);
      fs.writeFileSync(savedPath, Buffer.from(payload.audioDataBase64, 'base64'));
    }

    // Optionally forward to developer webhook (if they registered one)
    if (dev.webhook) {
      try {
        await fetch(dev.webhook, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-sdk-api-key': apiKey
          },
          body: JSON.stringify({
            ...payload,
            audioStoredPath: savedPath ? `/uploads/sdk/${path.basename(savedPath)}` : null
          })
        });
      } catch (e) {
        console.warn('Failed to forward to developer webhook', e);
      }
    }

    // We do not keep long-term sensor data for SDK clients by design (per your requirement).
    // Return minimal response
    res.json({ ok: true, stored: !!savedPath });
  } catch (err) {
    console.error('SDK /incidents error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});*/



module.exports = router;
