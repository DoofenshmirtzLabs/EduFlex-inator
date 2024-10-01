import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// User registration
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Check if the user already exists
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "Email already registered" });

    // Create a new user
    const user = new User({ username, email, password });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error registering user", error: err.message });
  }
});

// User login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    // Validate password
    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, 'chocolate_banana', {
      expiresIn: "1h",
    });

    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err.message });
  }
});

export { router };