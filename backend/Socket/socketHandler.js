// backend/Socket/socketHandler.js
const amqp = require("amqplib");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");
const Incident = require("../Model/incident");
const User = require("../Model/user");
require("dotenv").config();
const Fonoster = require("@fonoster/sdk");
const { setTimeout: delay } = require("timers/promises");
const tf = require("@tensorflow/tfjs");
//const tf = require("@tensorflow/tfjs-node");
const wav = require("wav-decoder");
const twilio = require("twilio");
const { analyzeAudio } = require("./analyzeAudio");



// -----------------------------------------------------
// Load YAMNet Model once at startup (local TFJS files)
// -----------------------------------------------------

/*
let yamnetModel = null;

async function loadYAMNetModel() {
  const modelUrl = "https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1";
  //yamnetModel = await tf.loadGraphModel(modelUrl, { fromTFHub: true });
  global.yamnetModel = await tf.loadGraphModel(modelUrl, { fromTFHub: true });
  console.log("YAMNet model loaded successfully");
}

loadYAMNetModel(); */



 global.yamnetModel = null;

async function loadYAMNetModel() {
    try {
        if (global.yamnetModel) { 
            console.log("YAMNet model already loaded");
            return global.yamnetModel;
        }

        // 🎯 Use the HTTP URL provided by your Express server (Step 2)
        const modelUrl = 'http://localhost:8800/models/yamnet/model.json';
        
        // This uses the standard JS fetch API, bypassing native bindings
        global.yamnetModel = await tf.loadGraphModel(modelUrl); 
        
        console.log("YAMNet model loaded successfully from HTTP:", modelUrl);

        return global.yamnetModel;
    } catch (err) {
        console.error("Failed to load YAMNet model:", err);
        throw err;
    }
}
loadYAMNetModel();

// -----------------------------------------------------
// 🔌 Main Socket Handler
// -----------------------------------------------------
module.exports = async (io) => {
  // Wait for model to load once before handling sockets
  await loadYAMNetModel();

  // RabbitMQ setup
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;


console.log("is twilio client connecting",accountSid)

console.log("is twilio client connecting",authToken)

console.log("is twilio client connecting",twilioNumber)

const twilioClient = twilio(accountSid, authToken);
console.log("is twilio client connecting",twilioClient)

  const rabbitUrl = process.env.RABBITMQ_URL;
  const connection = await amqp.connect(rabbitUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue("notification_queue", { durable: true });

  console.log("✅ Connected to RabbitMQ and ready to process incidents");

  io.on("connection", (socket) => {
    console.log(`🟢 Socket connected: ${socket.id}`);

    socket.on("sensorIncident", async (data) => {
      try {
        let threatResult = null;

        console.log("see user location data",data)


        if (data.audioData && global.yamnetModel) {
          console.log("yini marar ye")
          // const fullRecording = `glass_break_${Date.now()}.wav`;
          const tmpFile = path.join("uploads", `sensor_incident${Date.now()}_audio.ma4`);
          fs.writeFileSync(tmpFile, Buffer.from(data.audioData, "base64"));
          console.log("yini marar analyze")
          console.log("yini marar analyze temp", tmpFile)
          threatResult = await analyzeAudio(tmpFile);
          console.log("temp file")
          fs.unlinkSync(tmpFile);
        }

        const existingUser = await User.findOne({ email: data.userEmail });
        if (!existingUser) return;

        console.log("threatResult",threatResult)

        /*if (!threatResult.isThreat) {
    console.log("Not a threat, skipping save.");
    return; // exit early, do not save
}*/
// get user location, threatresult
        const incidentDoc = new Incident({
          userid: existingUser.userId,
          userEmail: data.userEmail,
          incidentDate: data.timestamp,
          incidentType: threatResult.label,
          audioUrl: threatResult.filePath,
          userLocation:data.userLocation
        });

        console.log("icident user")

        await incidentDoc.save();
/// find user by email
        await User.findByIdAndUpdate(
    existingUser.userId,
    { 
        $push: { 
            incident: incidentDoc._id // Push the new ID into the 'incidents' array
        }
    },
    { new: true } // Return the updated document
);

        io.emit("newIncident", { ...incidentDoc.toObject(), threat: threatResult });
        console.log("icident user one")

          //const emergencyNumber = existingUser.emergencyContacts; // make sure you store it in DB
console.log("chck numbers",existingUser.emergencyContacts)
        if (existingUser.emergencyContacts?.length) {
  existingUser.emergencyContacts.forEach(async (contact) => {
    console.log("check numbers contact",contact)
    if (!contact.phone) return;

    const phoneNumber = contact.phone;
    console.log("check numbers contact call",phoneNumber)

    // 1️⃣ Send SMS
    twilioClient.messages
      .create({
        //body: `🚨 Emergency Alert: ${data.incidentType} detected for ${existingUser.email}`,
         body : `🚨 Emergency Alert! User: ${existingUser.firstName} Incident Type: ${data.incidentType} Location: ${data.userLocation} Please take immediate action!`,
        from: twilioNumber,
        to: phoneNumber,
      })
      .then((msg) => console.log(`SMS sent to ${contact.name || phoneNumber}:`, msg.sid))
      .catch((err) => console.error("SMS error:", err));

    // 2️⃣ Make call
    twilioClient.calls
      .create({
        url: `http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient`, // placeholder
        from: twilioNumber,
        to: phoneNumber,
      })
      .then((call) => {
        console.log(`Call initiated to ${contact.name || phoneNumber}:`, call.sid);

        // Auto hangup after 12 seconds
        setTimeout(async () => {
          try {
            await twilioClient.calls(call.sid).update({ status: "completed" });
            console.log(`Call to ${contact.name || phoneNumber} ended automatically after 12s`);
          } catch (err) {
            console.error("Error ending call:", err);
          }
        }, 12000);
      })
      .catch((err) => console.error("Call error:", err));
  });
}

        console.log("Incident processed successfully.");


        const notificationPayload = {
          type: "incident_alert",
          incidentId: incidentDoc._id,
          userId: data.userId,
          message: `Incident detected: ${data.incidentType}`,
        };
        console.log("icident user payload")
        channel.sendToQueue(
          "notification_queue",
          Buffer.from(JSON.stringify(notificationPayload)),
          { persistent: true }
        );

        console.log("📩 Notification queued in RabbitMQ");
      } catch (err) {
        console.error("❌ Error processing sensorIncident:", err);
      }
    });

    socket.on("updateSensorMode", async (data) => {
      const { userEmail, mode } = data;
      console.log(`⚙️ User ${userEmail} set sensor mode to ${mode}`);
      await User.updateOne({ email: userEmail }, { backgroundMonitor: mode });
      io.emit("sensorModeUpdated", { userEmail, mode });
    });

    socket.on("disconnect", () => {
      console.log(`⚡ Socket disconnected: ${socket.id}`);
    });
  });
};
