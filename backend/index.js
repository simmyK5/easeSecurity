const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const fileUpload = require("express-fileupload");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

// Logger
const logger = require("./logger"); // <-- add this

// Routes
const userRoute = require("./Route/user");
const adRoute = require("./Route/ad");
const subscriptionRoute = require("./Route/subscription");
const feedbackRoute = require("./Route/feedback");
const incidentRoute = require("./Route/incident");
const sdkRoute = require("./Route/sdkRoutes");

// Services
const socketHandler = require("./Socket/socketHandler");

dotenv.config();

// ================== Middleware ==================
const app = express();
app.use(helmet());
app.use(cors({ origin: ["exp://10.184.81.23:8081"], methods: ["GET","POST","PUT","DELETE","OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } }));
app.use(morgan("common"));

// ================== Static Files ==================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const modelDir = path.join(__dirname, 'yamnet_model_tfjs');
app.use('/models/yamnet', express.static(modelDir));
// ================== MongoDB Connection ==================
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    logger.info("MongoDB connected"); // <-- use logger
  } catch (err) {
    logger.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
})();

// ================== APIs ==================
app.use("/api/user", userRoute);
app.use("/api/ad", adRoute);
app.use("/api/subscription", subscriptionRoute);
app.use("/api/feedback", feedbackRoute);
app.use("/api/incident", incidentRoute);
app.use("/api/sdk", sdkRoute);

// Upload endpoint
app.post("/uploadSensor", async (req, res) => {
  if (!req.files || !req.files.voice) return res.status(400).send("No file uploaded.");
  try {
    const uploadedFile = req.files.voice;
    const fileName = `${Date.now()}_${uploadedFile.name}`;
    const uploadPath = path.join(__dirname, "uploads", fileName);
    await uploadedFile.mv(uploadPath);
    logger.info(`File uploaded: ${fileName}`); // <-- log uploads
    res.send({ message: "File uploaded successfully", fileName });
  } catch (err) {
    logger.error("Upload error:", err);
    res.status(500).send("Error during file upload.");
  }
});

// ================== HTTP + Socket Server ==================
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"], allowedHeaders: ["Content-Type","Authorization"] },
});

// Set io instance for use in routes/services
app.set("io", io);

// existing main socket handler
socketHandler(io);

// Register SDK socket namespace (live audio)
const sdkSocketHandler = require('./Socket/sdkSocketHandler');
sdkSocketHandler(io);


// ================== Background Services ==================
// scheduleVoucherGeneration();

// ================== Start Server ==================
const PORT = process.env.PORT || 8800;
server.listen(PORT, () => logger.info(`Backend running on http://localhost:${PORT}`));
