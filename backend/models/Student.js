const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },

  name: String,
  heartRate: Number,
  restingHR: Number,
  hrv: Number,
  spo2: Number,
  sleepHours: Number,
  steps: Number,
});

module.exports = mongoose.model("Student", StudentSchema);