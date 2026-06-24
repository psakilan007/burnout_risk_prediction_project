const jwt = require("jsonwebtoken");

const JWT_SECRET = "burnout_secret_key";

module.exports = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return res.status(401).json({
        message: "No token"
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    console.log("Logged User:", req.user);

    next();
  } catch (error) {
    console.error(error);

    res.status(401).json({
      message: "Invalid Token"
    });
  }
};