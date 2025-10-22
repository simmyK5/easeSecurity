const express = require('express');
const path = require('path');
const Ad = require('../Model/ad');
const User = require('../Model/user');
const fs = require('fs');
const { v4: uuid } = require('uuid');
require('dotenv').config();

const router = express.Router(); // Just router, no use(cors()), etc here


router.use('/uploadFile', express.static(path.join(__dirname, 'uploads')));


router.post('/upload-image', async (req, res) => {
  if (!req.files?.image) return res.status(400).json({ error: 'No image uploaded' });

  const img = req.files.image;
  if (!img.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'Only images allowed' });
  }

  const filename = `${uuid()}${path.extname(img.name)}`;
  const dest = path.join(__dirname, '../uploads', filename);

  img.mv(dest, err => {
    if (err) return res.status(500).json({ error: 'Failed to save image' });
    res.json({ filename });
  });
});

router.post('/payment/notify', async (req, res) => {
  const { payment_status, custom_str1: email, custom_str2, custom_str3: filename } = req.body;

  if (payment_status !== 'COMPLETE') return res.status(400).end();

  try {
    const adMeta = JSON.parse(custom_str2);
    const ad = await Ad.create({
      ...adMeta,
      email,
      imagePath: `/uploads/${filename}`,
      status: 'ACTIVE',
    });

    res.json({ success: true, ad });
  } catch (err) {
    console.error('Ad creation failed:', err);
    res.status(500).end();
  }
});



// PayFast return URL (after successful payment)
router.get('/success', (req, res) => {

  // You can access query parameters from PayFast here
  const paymentData = req.query;
  console.log("Payment data received: ", paymentData);

  // Redirect user to a success page or render the success page

  res.redirect('http://localhost:3000/profile');
});

// PayFast cancel URL (when the user cancels payment)
router.get('/cancel', (req, res) => {
  console.log("Payment cancelled, returning user to cancel page");

  // You can access query parameters from PayFast here
  const paymentData = req.query;
  console.log("Payment data received: ", paymentData);

  // Redirect user to a cancel page or render the cancel page
  res.redirect('http://localhost:3000/');  // You can customize this to redirect to a frontend route or render HTML
});

router.get('/ads', async (req, res) => {
  const { currentDate } = req.query; // Get current date from request query
  const currentDateObj = new Date(currentDate); // Convert to Date object
  console.log("check current date", currentDateObj)

  try {
    const ads = await Ad.find();

    // Filter ads based on startDate and endDate
    const filteredAds = ads.filter(ad => {
      const adStartDate = new Date(ad.startDate); // Assuming startDate exists
      const adEndDate = new Date(ad.endDate); // Assuming endDate exists
      console.log(`Ad Start: ${adStartDate}, Ad End: ${adEndDate}, Current Date: ${currentDateObj}`);

      return adStartDate <= currentDateObj && adEndDate >= currentDateObj;
    });
    console.log("see filterd ads", filteredAds)
    return res.status(200).json(filteredAds);
  } catch (err) {
    console.error('Error fetching Ad data:', err);
    res.status(500).send('Server error');
  }
});



router.get('/randomAd', async (req, res) => {
  console.log("Fetching random active ads...");

  const currentDate = new Date(); // Get today's date

  try {
    const randomImages = await Ad.aggregate([
      {
        $match: {
          startDate: { $lte: currentDate }, // startDate is on or before today
          endDate: { $gte: currentDate }    // endDate is on or after today
        }
      },
      { $sample: { size: 5 } } // Randomly pick 5 ads
    ]);

    res.json(randomImages);
  } catch (error) {
    console.error('Error fetching random images:', error);
    res.status(500).json({ error: error.message });
  }
});



router.delete("/:id", async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id)
    if (ad._id) {
      await ad.deleteOne()
      res.status(200).json("Feedback deleted")
    } else {
      res.status(403).json("Don't have permissions to delete this feedback")
    }

  } catch (error) {

    res.status(500).json(error)
  }
})


module.exports = router;
