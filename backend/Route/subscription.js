const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bodyParser = require("body-parser");
const User = require("../Model/user");


require("dotenv").config();

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

// PayFast credentials
const {
  PAYFAST_MERCHANT_ID,
  PAYFAST_MERCHANT_KEY,
  PAYFAST_RETURN_URL,
  PAYFAST_CANCEL_URL,
  PAYFAST_NOTIFY_URL,
  PAYFAST_PASSPHRASE,
  BACKEND_URL
} = process.env;

// ✅ Utility: generate PayFast signature (same as web)
const generateSignature = (data, passphrase = null) => {
  const orderedData = {};
  Object.keys(data)
    .sort()
    .forEach((key) => {
      orderedData[key] = data[key];
    });

  let getString = "";
  for (let key in orderedData) {
    getString +=
      key + "=" + encodeURIComponent(orderedData[key]).replace(/%20/g, "+") + "&";
  }
  getString = getString.slice(0, -1); // remove trailing &

  if (passphrase) {
    getString +=
      "&passphrase=" +
      encodeURIComponent(passphrase.trim()).replace(/%20/g, "+");
  }

  return crypto.createHash("md5").update(getString).digest("hex");
};


router.post("/initiate", (req, res) => {
  try {
    const { email, firstName, lastName, amount, role,emergencyContact } = req.body;
    if (!email || !amount) {
      return res.status(400).json({ message: "Missing email or amount" });
    }

    const formattedAmount = Number(amount).toFixed(2);

    // 1. Prepare Base Data
    const data = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: PAYFAST_RETURN_URL,
      cancel_url: PAYFAST_CANCEL_URL,
      notify_url: PAYFAST_NOTIFY_URL,
      email_address: email,
      name_first: firstName,
      name_last: lastName,
      amount: formattedAmount,
      item_name: `EaseSecurity Subscription (${role})`,
      custom_str1: role,
      custom_str2: JSON.stringify(emergencyContact),
    };


    // 3. Combine Data and Signature
     const signature = generateSignature(data, PAYFAST_PASSPHRASE);

    // Pass data as query parameters to /payfast-form endpoint
    const params = Object.keys(data)
      .map((k) => `${k}=${encodeURIComponent(data[k]).replace(/%20/g, "+")}`)
      .join("&");
      console.log("what undefined",BACKEND_URL)
    const paymentPageUrl = `https://sandbox.payfast.co.za/eng/process?${params}`;

    res.json({ paymentPageUrl });
    
  } catch (err) {
    console.error("PayFast init error:", err);
    res.status(500).json({ message: "Error initiating payment", error: err.message });
  }
});

// backend/routes/subscription.js
router.get("/success", (req, res) => {
  // If you’re testing locally with Expo Go, redirect to Expo deep link
  const deepLink = process.env.NODE_ENV === "development"
    ? "exp://10.200.106.23:8081/--/payment-success"
    : "easeapp://payment-success"; // for standalone build later

  console.log("✅ Redirecting to deep link:", deepLink);

  res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="1;url=${deepLink}" />
      </head>
      <body style="text-align:center;font-family:sans-serif;margin-top:50px;">
        <h2>✅ Payment Successful!</h2>
        <p>Redirecting you back to the app...</p>
        <script>
          setTimeout(() => {
            window.location.href = "${deepLink}";
          }, 1000);
        </script>
      </body>
    </html>
  `);
});

router.get("/cancel", (req, res) => {
  // If you’re testing locally with Expo Go, redirect to Expo deep link
  const deepLink = process.env.NODE_ENV === "development"
    ? "exp://10.200.106.23:8081/--/payment-cancelled"
    : "easeapp://payment-cancelled-success"; // for standalone build later

  console.log("✅ Redirecting to deep link:", deepLink);

  res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="1;url=${deepLink}" />
      </head>
      <body style="text-align:center;font-family:sans-serif;margin-top:50px;">
        <h2>❌ Payment Cancelled</h2>
        <p>Redirecting you back to the app...</p>
        <script>
          setTimeout(() => {
            window.location.href = "${deepLink}";
          }, 1000);
        </script>
      </body>
    </html>
  `);
});


// POST /payment/notify (IPN)
router.post("/payment/notify", async (req, res) => {
  try {
    // Assuming 'User' is your MongoDB model
    const { payment_status, email_address,name_first,name_last,custom_str2 } = req.body;
    
    let emergencyContact = JSON.parse(custom_str2)

    if (payment_status === "COMPLETE") {
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // IMPORTANT: Ensure 'User' is correctly imported and available
       await User.findOneAndUpdate(
        { email: email_address },
        { isActive: true, nextBillingDate, firstName:name_first,lastName:name_last,emergencyContacts:emergencyContact},
        { new: true }
      );
      console.log(`[IPN] User ${email_address} subscription COMPLETE. (DB Update Mocked)`);
    } else if (payment_status === "CANCELLED") {
      const nextBillingDate = new Date();
       await User.findOneAndUpdate(
        { email: email_address },
        { isActive: false, nextBillingDate, firstName:name_first,lastName:name_last,emergencyContacts:emergencyContact },
         { new: true }
       );
      console.log(`[IPN] User ${email_address} subscription CANCELLED. (DB Update Mocked)`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing PayFast IPN");
  }
});


/*

router.post("/payment/notify", async (req, res) => {
  try {
    // Assuming 'User' is your MongoDB model
    const { payment_status, email_address } = req.body;

    if (payment_status === "COMPLETE") {

      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // IMPORTANT: Ensure 'User' is correctly imported and available
      // await User.findOneAndUpdate(
      //   { email: email_address },
      //   { isActive: true, nextBillingDate },
      //   { new: true }
      // );
      // activeSubscriptions[email_address] = true;
      console.log(`[IPN] User ${email_address} subscription COMPLETE. (DB Update Mocked)`);
    } else if (payment_status === "CANCELLED") {
      // await User.findOneAndUpdate(
      //   { email: email_address },
      //   { isActive: false },
      //   { new: true }
      // );
      console.log(`[IPN] User ${email_address} subscription CANCELLED. (DB Update Mocked)`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing PayFast IPN");
  }
});

*/


/////////////////////////////////*****************************************************///////////////////////////////////
 
//                                        Below config for
//                                           Web app

////////////////////////////////******************************************************//////////////////////////////////

const FRONTEND_URL =
process.env.FRONTEND_URL || "http://localhost:3000"; // Your Next.js frontend
const PASS_PHRASE = process.env.PAYFAST_PASSPHRASE || "";

router.post("/webapp/notify", async (req, res) => {
  try {
    // Assuming 'User' is your MongoDB model
    const { payment_status, email_address } = req.body;

    if (payment_status === "COMPLETE") {
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // IMPORTANT: Ensure 'User' is correctly imported and available
      // await User.findOneAndUpdate(
      //   { email: email_address },
      //   { isActive: true, nextBillingDate },
      //   { new: true }
      // );
      // activeSubscriptions[email_address] = true;
      console.log(`[IPN] User ${email_address} subscription COMPLETE. (DB Update Mocked)`);
    } else if (payment_status === "CANCELLED") {
      // await User.findOneAndUpdate(
      //   { email: email_address },
      //   { isActive: false },
      //   { new: true }
      // );
      console.log(`[IPN] User ${email_address} subscription CANCELLED. (DB Update Mocked)`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing PayFast IPN");
  }
});

router.get("/webapp/success", (req, res) => {
  const deepLink = `${FRONTEND_URL}/payment-success`;
  console.log("✅ Redirecting user to:", deepLink);

  return res.redirect(302, deepLink);

  /*res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="1;url=${deepLink}" />
      </head>
      <body style="text-align:center;font-family:sans-serif;margin-top:50px;">
        <h2>✅ Payment Successful!</h2>
        <p>Redirecting you back to the web app...</p>
        <script>
          setTimeout(() => window.location.href = "${deepLink}", 1000);
        </script>
      </body>
    </html>
  `);*/
});

router.get("/webapp/cancel", (req, res) => {
  const cancelLink = `${FRONTEND_URL}/payment-cancel`;
  console.log("🚫 Payment cancelled. Redirecting to:", cancelLink);

  return res.redirect(302, cancelLink);

  /*res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="1;url=${cancelLink}" />
      </head>
      <body style="text-align:center;font-family:sans-serif;margin-top:50px;">
        <h2>❌ Payment Cancelled!</h2>
        <p>Returning to your dashboard...</p>
        <script>
          setTimeout(() => window.location.href = "${cancelLink}", 1000);
        </script>
      </body>
    </html>
  `);*/
});


module.exports = router;
