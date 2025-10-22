
const User = require('../Model/user');
const Incident = require('../Model/incident');
const express = require('express');
const cors = require('cors');
const router = express();
const bodyParser = require('body-parser');
router.use(cors());
router.use(bodyParser.json())

router.get("/:email", async (req, res) => {
  const { email } = req.params;
  const incidents = await Incident.find({ userEmail: email }).sort({ timestamp: -1 });
  res.json(incidents);
});





module.exports = router;