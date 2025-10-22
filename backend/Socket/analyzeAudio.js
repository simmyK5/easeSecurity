const fs = require("fs");
const path = require("path");
const tf = require("@tensorflow/tfjs");
const wav = require("wav-decoder");
const ffmpeg = require("fluent-ffmpeg");
const { path: ffmpegPath } = require("@ffmpeg-installer/ffmpeg");


ffmpeg.setFfmpegPath(ffmpegPath);

async function convertToWav(inputPath) {
    const outputDir = path.join(__dirname, '../../tmp/converted');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `converted_${Date.now()}.wav`);

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath) // FFmpeg auto-detects format from inputPath
            // 💡 FIX: Remove .inputOptions() as it interferes with .wav
            .inputOptions('-f', 's16le', '-ar', '44100', '-ac', '1')
            .outputOptions([
                // These are the correct output options for YAMNet
                '-ar 16000', // Resample to 16kHz
                '-ac 1',     // Convert to mono
                '-f wav'     // Ensure output format is WAV
            ])
            .on('start', cmd => console.log('ffmpeg cmd:', cmd))
            .on('end', () => {
                console.log('Conversion complete:', outputPath);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('ffmpeg error:', err.message);
                reject(new Error(`ffmpeg exited with code 1: ${err.message}`));
            })
            .save(outputPath);
    });
}

/*
async function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions('-f s16le', '-ar 44100', '-ac 1') // adjust if raw PCM
      .outputOptions('-ar 16000', '-ac 1', '-f wav')
      .on('start', cmd => console.log('ffmpeg cmd:', cmd))
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}*/

async function decodeWavSafe(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 44) throw new Error("Invalid WAV: too small");

    const buffer = fs.readFileSync(filePath);
    const decoded = await wav.decode(buffer);

    if (!decoded.channelData?.length) throw new Error("Empty channel data");
    return decoded.channelData[0];
  } catch (err) {
    console.error("Error decoding WAV:", err.message);
    throw err;
  }
}

async function analyzeAudio(filePath) {
  try {
    if (!global.yamnetModel) {
      console.warn("Model not ready, skipping analysis");
      return null;
    }

    console.log("Converting to WAV:", filePath);
    const wavPath = await convertToWav(filePath);

    console.log("Decoding WAV:", wavPath);
    const audioFloat32 = await decodeWavSafe(wavPath);

    // Normalize long or short files to YAMNet’s input window (16kHz × 1s)
    const SAMPLE_RATE = 16000;
    const TARGET_LENGTH = SAMPLE_RATE; // 1 second
    let audioTensor = tf.tensor1d(audioFloat32);

    if (audioTensor.size > TARGET_LENGTH) {
      // Truncate long audio
      audioTensor = audioTensor.slice(0, TARGET_LENGTH);
    } else if (audioTensor.size < TARGET_LENGTH) {
      // Pad short audio
      const pad = tf.zeros([TARGET_LENGTH - audioTensor.size]);
      audioTensor = tf.concat([audioTensor, pad]);
    }

    console.log("Running prediction...");
    const scoresTensor = global.yamnetModel.execute(
      { waveform: audioTensor },
      global.yamnetModel.outputs[0].name
    );

    const scores = scoresTensor.arraySync();
    const labels = ["Speech", "Singing", "Gunshot", "Glass", "Scream", "Fighting", "Explosion"];

    let maxIdx = 0;
    let maxScore = 0;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > maxScore) {
        maxIdx = i;
        maxScore = scores[i];
      }
    }

    const label = labels[maxIdx] || "Unknown";
    const isThreat = ["Speech","Gunshot", "Glass", "Scream", "Fighting", "Explosion"].includes(label) && maxScore > 0.6;

    console.log("Analysis result:", { label, confidence: maxScore, isThreat, filePath });
    return { isThreat };
  } catch (error) {
    console.error("Error analyzing audio:", error);
    return null;
  }
}

/*async function analyzeAudio(filePath) {
    try {
        if (!global.yamnetModel) {
            console.warn("⚠️ Model not ready, skipping analysis");
            return null;
        }

        console.log("Converting to WAV...",filePath);
        const wavPath = await convertToWav(filePath);

        console.log("Decoding WAV...");
        const audioFloat32 = await decodeWav(wavPath);
        //const audioTensor = tf.tensor(audioFloat32, [1, audioFloat32.length]);
        const audioTensor = tf.tensor1d(audioFloat32);
        console.log("Running prediction...");

        console.log("Inputs:", global.yamnetModel.inputs.map(i => i.name));
        console.log("Outputs:", global.yamnetModel.outputs.map(o => o.name));
        const predictionsMap = global.yamnetModel.execute(
            { waveform: audioTensor }, // input node name from step 1
            global.yamnetModel.outputs[0].name // output node name from step 1
        );

        // predictionsMap is a tf.Tensor
        const scores = predictionsMap.arraySync(); // now you can call arraySync
        const classLabels = [
            "Speech",
            "Singing",
            "Gunshot",
            "Glass",
            "Scream",
            "Fighting",
            "Explosion",
        ];

        let maxIdx = 0;
        let maxScore = 0;
        for (let i = 0; i < scores.length; i++) {
            if (scores[i] > maxScore) {
                maxScore = scores[i];
                maxIdx = i;
            }
        }

        const label = classLabels[maxIdx] || "Unknown";
        const isThreat =
            ["Gunshot", "Glass", "Scream", "Fighting", "Explosion"].includes(label) &&
            maxScore > 0.6;

        console.log("Analysis result:", { label, confidence: maxScore, isThreat,filePath });
        return { label, confidence: maxScore, isThreat,filePath };
    } catch (error) {
        console.error("Error analyzing audio:", error);
        return null;
    }
}*/

module.exports = { analyzeAudio };
