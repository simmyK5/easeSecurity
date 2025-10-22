const User = require('../Model/user');
const express = require('express');
const router = express.Router();
require('dotenv').config();


router.post("/", async (req, res) => {
  console.log("what's happening",req.body)
  const { email,firstName = '', lastName = '',userRole,emergencyContacts} = req.body;

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    // If user already exists, don't try to re-register — just respond.
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" }); // 409 Conflict
    }

    const newUser = new User({
      email: email.toLowerCase(),
      firstName,
      lastName,
      termsAndConditions: true,
      userRole,
      phoneNumber:'',
      emergencyContacts:emergencyContacts,
      backgroundMonitor:'off'


    });
console.log("what's happening user",newUser)
    await newUser.save();

    res.status(201).json(newUser);
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).send('Server error');
  }
});

router.post('/updateProfile', async (req, res) => {
  const { email, firstName, lastName, termsAndConditions,emergencyContacts } = req.body;
  try {
    const updatedUser = await User.findOneAndUpdate(
      { email },
      { firstName, lastName, termsAndConditions,emergencyContacts },
      { new: true }
    );
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




module.exports = router;
