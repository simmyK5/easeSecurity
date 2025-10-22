// queue/notificationQueue.js
const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL);

// Create the notification queue
const notificationQueue = new Queue("notifications", { connection });

// Worker to process jobs
const worker = new Worker(
  "notifications",
  async (job) => {
    console.log(`Processing job: ${job.name}`, job.data);

    switch (job.name) {
      case "sendEmail":
        // Integrate with EmailJS/SendGrid
        console.log("Sending email:", job.data);
        break;
      case "sendSMS":
        // Integrate with Telnyx/Twilio
        console.log("Sending SMS:", job.data);
        break;
      case "sendPush":
        // Integrate with Firebase Cloud Messaging
        console.log("Sending Push Notification:", job.data);
        break;
      default:
        console.log("Unknown job type:", job.name);
    }
  },
  { connection }
);

// Optional: logging
worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`Job ${job.id} failed:`, err));

module.exports = {
  notificationQueue,
  worker,
};
