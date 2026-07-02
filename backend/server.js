require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const Student = require("./models/Student");
const authRoutes = require("./routes/authRoutes");
const burnoutRoutes = require("./routes/burnoutRoutes");
const auth = require("./middleware/auth");
const chatbotRoutes = require("./routes/chatbotRoutes");
const app = express();
const PORT = 5000;

// ======================
// Middleware
// ======================
app.use(cors());
app.use(express.json());

// ======================
// Routes
// ======================
app.use("/api/auth", authRoutes);
app.use("/api/burnout", burnoutRoutes);
app.use("/api/chat", chatbotRoutes);
// ======================
// MongoDB Connection
// ======================
mongoose
  .connect("mongodb://127.0.0.1:27017/burnout_dashboard")
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.error("MongoDB Error:", err);
  });

// ======================
// Home Route
// ======================
app.get("/", (req, res) => {
  res.send("Burnout Dashboard Backend Running");
});

// ======================
// Save Student Data
// ======================
app.post("/api/student", auth, async (req, res) => {
  try {
    const student = new Student({
      userId: String(req.user.id),

      name: req.body.name,
      heartRate: req.body.heartRate,
      restingHR: req.body.restingHR,
      hrv: req.body.hrv,
      spo2: req.body.spo2,
      sleepHours: req.body.sleepHours,
      steps: req.body.steps,
    });

    await student.save();

    res.status(201).json({
      success: true,
      message: "Student Data Saved Successfully",
      student,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Error Saving Student Data",
    });
  }
});

// ======================
// Get All Student Records
// ======================
app.get("/api/student", auth, async (req, res) => {
  try {
    const students = await Student.find({
      userId: String(req.user.id),
    });

    res.json(students);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error Fetching Student Data",
    });
  }
});

// ======================
// Get Latest Student Record
// ======================
app.get("/api/student/latest", auth, async (req, res) => {
  try {
    console.log("========== DEBUG ==========");
    console.log("req.user =", req.user);
    console.log("req.user.id =", req.user.id);

    const latestStudent = await Student.findOne({
      userId: String(req.user.id),
    }).sort({ _id: -1 });

    console.log("Latest Student =", latestStudent);
    console.log("===========================");

    if (!latestStudent) {
      return res.status(404).json({
        message: "No student data found",
      });
    }

    res.json(latestStudent);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error Fetching Latest Student Data",
    });
  }
});

// ======================
// Check All Students
// ======================
app.get("/checkstudents", async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
});

// ======================
// Seed Demo Student
// ======================
app.get("/seed", async (req, res) => {
  try {
    const student = new Student({
      userId: "demo",
      name: "Akilan",
      heartRate: 80,
      restingHR: 82,
      hrv: 35,
      spo2: 98,
      sleepHours: 5,
      steps: 3000,
    });

    await student.save();

    res.send("Sample Student Added");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error Adding Sample Student");
  }
});

// ======================
// Test Route
// ======================
app.get("/test", (req, res) => {
  res.send("Server Working");
});

// ======================
// Debug Route
// ======================
app.get("/debug", async (req, res) => {
  try {
    const count = await Student.countDocuments();

    res.json({
      modelLoaded: true,
      count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json(error.message);
  }
});

// ======================
// Start Server
// ======================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});