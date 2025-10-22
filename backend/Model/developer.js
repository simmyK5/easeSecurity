// backend/src/models/Developer.js
const mongoose = require('mongoose');

const DeveloperSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, index: true, unique: true },
  email: { type: String, required: true, index: true, unique: true },
  name: { type: String },
  clientId: { type: String, required: true, unique: true },
  clientSecretHash: { type: String, required: true },
  quotaRemaining: { type: Number, default: 50 }, // free 50 calls
}, { timestamps: true });

module.exports = mongoose.model('Developer', DeveloperSchema);
