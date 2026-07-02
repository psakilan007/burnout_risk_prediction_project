const express = require("express");
const axios = require("axios");

const router = express.Router();

const Student = require("../models/Student");
const auth = require("../middleware/auth");

router.get("/predict", auth, async (req, res) => {
  try {
    const student = await Student.findOne({
      userId: String(req.user.id),
    }).sort({ _id: -1 });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student data found",
      });
    }

    // ==========================
    // Call Python ML API
    // ==========================
    const mlResponse = await axios.post(
      "http://127.0.0.1:8000/predict",
      {
        sleep_duration_hours: student.sleepHours,
        sleep_efficiency: 90,
        hrv_rmssd_ms: student.hrv,
        avg_hr_day_bpm: student.heartRate,
        resting_hr_bpm: student.restingHR,
        steps: student.steps,
        screen_time_min: 180,
        workout_minutes: 45,
        mindfulness_minutes: 20 ,
      }
    );

    const stressScore =
      mlResponse.data.stress_score;

    let risk = "";

    if (stressScore >= 70) {
      risk = "High Burnout Risk";
    } else if (stressScore >= 40) {
      risk = "Moderate Burnout Risk";
    } else {
      risk = "Low Burnout Risk";
    }

    res.json({
      success: true,
      userId: req.user.id,
      name: student.name,
      score: stressScore,
      risk,
      student,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;