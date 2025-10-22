const mongoose = require("mongoose");
const { type } = require("os");

const EmergencyContactSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
});

const UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        max: 500
    },
    lastName: {
        type: String,
        max: 500
    },
    email: {
        type: String,
        required: true,
        max: 50,
        unique: true,
        lowercase: true,
    },
    phoneNumber: {
        type: String,
        max: 15
    },
    isActive: {
        type: Boolean
    },
    termsAndConditions: {
        type: Boolean
    },
    nextBillingDate:{
        type:Date
    },
    userRole: {
        type: String,
    },
    isActive:{
        type:Boolean
    },
    backgroundMonitor: {
        type: String,
        max: 50
    },
    emergencyContacts: [EmergencyContactSchema],

    incident: [{ type: mongoose.Schema.Types.ObjectId, ref: 'IncidentSensor' }]
},
    { timestamps: true }
)
module.exports = mongoose.model("User", UserSchema)