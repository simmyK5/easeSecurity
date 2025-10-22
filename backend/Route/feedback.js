
const User = require('../Model/user');
const Feedback = require('../Model/feedback');
const express = require('express');
const cors = require('cors');
const router = express();
const bodyParser = require('body-parser');
router.use(cors());
router.use(bodyParser.json())


router.post("/", async (req, res) => {
    console.log(req.body)
    const { name, email, message } = req.body;
    
    const newFeedback = new Feedback({
        name,
        email,
        description: message
    });
    try {

        const savedFeedback = await newFeedback.save()
        res.status(200).json(savedFeedback)
    } catch (error) {
        res.status(401).json(error)
    }
});




module.exports = router;