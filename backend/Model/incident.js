const mongoose = require("mongoose")

const UserLocationSchema = new mongoose.Schema({
    lat: String,
    long: String,
    streetName: String,
});


const IncidentSchema = new mongoose.Schema({
    incidentType: String,
    audioUrl: String,
    userLocation: [UserLocationSchema],
    userEmail:String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    incidentDate:Date,
},
    { timestamps: true }
)
module.exports = mongoose.model("IncidentSensor", IncidentSchema)