import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authenticate = async (req, res, next) => {
  let token = req.headers.authorization;

  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7, token.length); // Remove 'Bearer ' from string
  } else {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, '');
    req.user = await User.findById(decoded.id).select("-password"); // Exclude password
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
