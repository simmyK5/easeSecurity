const mongoose = require("mongoose")
const FeedbackSchema = new mongoose.Schema({
    name:{
        type:String,
        require:true
    },
    email:{
        type:String,
        require:true
    },
    description:{
        type:String,
        require:true
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
},
    { timestamps: true }
)
module.exports = mongoose.model("Feedback", FeedbackSchema)