const mongoose = require("mongoose")
const FeedbackSchema = new mongoose.Schema({
    email:{
        type:String,
        require:true
    }
},
    { timestamps: true }
)
module.exports = mongoose.model("Feedback", FeedbackSchema)