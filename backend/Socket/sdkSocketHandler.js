// backend/src/socket/sdkSocketHandler.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // npm i node-fetch@2
const mkdirp = require('mkdirp');

// Basic API key validation placeholder
async function validateApiKey(apiKey) {
  if (!apiKey) return false;
  if (process.env.SDK_MASTER_KEY && apiKey === process.env.SDK_MASTER_KEY) return true;
  return true; // temporarily accept any non-empty key
}

module.exports = function registerSdkSocket(io) {
  const nsp = io.of('/sdk');

   nsp.on('connection', async (socket) => {
    try {
      const apiKey = socket.handshake?.query?.apiKey || socket.handshake?.auth?.apiKey;
      const streamId = socket.handshake?.query?.streamId || socket.id;

      if (!apiKey || apiKey !== process.env.SDK_MASTER_KEY) {
        socket.emit('error', { message: 'Invalid API key' });
        return socket.disconnect(true);
      }

      console.log(`[SDK] client connected: ${socket.id}, streamId=${streamId}`);

      const baseTmp = path.join(__dirname, '../../tmp/sdk');
      await mkdirp(baseTmp);

      const streamDir = path.join(baseTmp, streamId);
      await mkdirp(streamDir);

      let chunkCounter = 0;
      const chunks = []; // store chunk buffers in memory

      socket.on('audio_chunk', async (msg) => {
        try {
          if (!msg || !msg.audioBase64) return;

          const seq = typeof msg.seq === 'number' ? msg.seq : chunkCounter++;
          const buffer = Buffer.from(msg.audioBase64, 'base64');
          chunks.push(buffer);

          nsp.emit('audio_chunk_received', { streamId, seq });

          if (msg.final) {
            // Step 1: Save concatenated raw audio as temporary file
            const rawPath = path.join(streamDir, `${streamId}_raw.pcm`);
            fs.writeFileSync(rawPath, Buffer.concat(chunks));

            // Step 2: Convert raw PCM to WAV (16kHz mono) for YAMNet
            const wavPath = path.join(baseTmp, `${streamId}_${Date.now()}.wav`);
            await new Promise((resolve, reject) => {
              ffmpeg(rawPath)
                .inputOptions('-f', 's16le', '-ar', '44100', '-ac', '1') // adjust input format if needed
                .outputOptions('-ar 16000', '-ac 1', '-f wav')
                .on('start', (cmd) => console.log('[SDK] ffmpeg command:', cmd))
                .on('end', resolve)
                .on('error', reject)
                .save(wavPath);
            });

            fs.unlinkSync(rawPath); // cleanup raw file
            fs.rmSync(streamDir, { recursive: true, force: true }); // cleanup chunk dir

            console.log(`[SDK] WAV ready: ${wavPath}`);

            // Step 3: Send WAV to backend /api/sdk/incidents
            const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 8800}`;
            const formData = new FormData();
            formData.append('file', fs.createReadStream(wavPath));

            const res = await fetch(`${backendUrl}/api/sdk/incidents`, {
              method: 'POST',
              body: formData,
              headers: formData.getHeaders(),
            });

            const result = await res.json();
            socket.emit('analysis_result', { streamId, result });

            fs.unlinkSync(wavPath); // cleanup WAV
          }
        } catch (err) {
          console.error('[SDK] audio_chunk error:', err);
          socket.emit('error', { message: 'chunk processing failed' });
        }
      });

      socket.on('disconnect', () => {
        console.log(`[SDK] disconnected: ${socket.id}`);
      });
    } catch (err) {
      console.error('[SDK] connection error', err);
      socket.disconnect(true);
    }
  });
};



/*// backend/src/socket/sdkSocketHandler.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // npm i node-fetch@2 (CJS)
const mkdirp = require('mkdirp'); // npm i mkdirp

// Minimal apiKey validation placeholder: replace with DB lookup
async function validateApiKey(apiKey) {
  // TODO: check against Developer collection in DB; for now accept env key or non-empty
  if (!apiKey) return false;
  if (process.env.SDK_MASTER_KEY && apiKey === process.env.SDK_MASTER_KEY) return true;
  // Example: load Developer collection by apiKey...
  return true;
}

module.exports = function registerSdkSocket(io) {
  const nsp = io.of('/sdk');

  nsp.on('connection', async (socket) => {
    try {
      const apiKey = socket.handshake?.query?.apiKey || socket.handshake?.auth?.apiKey;
      const streamId = socket.handshake?.query?.streamId || socket.id;

      if (!await validateApiKey(apiKey)) {
        socket.emit('error', { message: 'Invalid API key' });
        socket.disconnect(true);
        return;
      }

      console.log(`[SDK] client connected: ${socket.id}, streamId=${streamId}`);

      // Ensure temp folder exists
      const baseTmp = path.join(__dirname, '../../tmp/sdk');
      await mkdirp(baseTmp);

      // per-stream folder
      const streamDir = path.join(baseTmp, streamId);
      await mkdirp(streamDir);

      socket.on('audio_chunk', async (msg) => {
        // msg = { audioBase64, seq?, final?, metadata? }
        try {
          if (!msg || !msg.audioBase64) return;

          const seq = typeof msg.seq === 'number' ? msg.seq : Date.now();
          const filename = path.join(streamDir, `${seq}.chunk`);
          const buffer = Buffer.from(msg.audioBase64, 'base64');
          fs.writeFileSync(filename, buffer);

          // broadcast to any admin consoles subscribed to sdk events
          nsp.emit('audio_chunk_received', { streamId, seq });

          if (msg.final) {
            // assemble files in numeric order
            const files = fs.readdirSync(streamDir)
              .filter(f => f.endsWith('.chunk'))
              .sort((a,b) => {
                const na = parseInt(a.replace('.chunk',''));
                const nb = parseInt(b.replace('.chunk',''));
                return na - nb;
              });

            const assembledPath = path.join(baseTmp, `${streamId}_${Date.now()}.wav`);
            const writeStream = fs.createWriteStream(assembledPath);

            for (const f of files) {
              const chunkBuf = fs.readFileSync(path.join(streamDir, f));
              writeStream.write(chunkBuf);
            }
            writeStream.end();

            // cleanup streamDir
            fs.rmSync(streamDir, { recursive: true, force: true });

            // emit assembled event with path (backend only) and optionally forward
            nsp.emit('sdk:assembled', { streamId, path: assembledPath });

            // Optional: forward assembled audio to developer webhook (if registered)
            // TODO: lookup developer webhook by apiKey and POST multipart/form-data or base64
          }
        } catch (err) {
          console.error('[SDK] audio_chunk error:', err);
          socket.emit('error', { message: 'chunk processing failed' });
        }
      });

      socket.on('reportIncident', async (payload) => {
        // Alternative: SDK can send final incident via socket
        // payload: { userEmail, timestamp, audioBase64, metadata }
        try {
          // Basic forwarding: POST to backend route that will handle (reuse routes)
          const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 8800}`;
          await fetch(`${backendUrl}/api/sdk/incidents`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': apiKey
            },
            body: JSON.stringify(payload)
          });
          socket.emit('reportAck', { ok: true });
        } catch (err) {
          console.error('[SDK] reportIncident error', err);
        }
      });

      socket.on('disconnect', () => {
        console.log(`[SDK] disconnected: ${socket.id}`);
      });
    } catch (err) {
      console.error('[SDK] connection error', err);
      socket.disconnect(true);
    }
  });
};
*/