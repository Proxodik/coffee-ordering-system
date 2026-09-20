import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Admin } from "../models/Admin";

export const requireAdmin: RequestHandler = async (req, res, next) => {
  // Отримання токена з cookie
  const token = req.cookies?.admin_token;

  if (typeof token !== "string") {
    res.status(401).json({
      message: "Authentication required",
    });
    return;
  }

  // Перевірка наявності секретного ключа
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("JWT_SECRET is not defined");

    res.status(500).json({
      message: "Internal server error",
    });
    return;
  }

  try {
    // Перевірка підпису, терміну дії та даних токена
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload === "string" ||
      payload.role !== "admin" ||
      typeof payload.sub !== "string" ||
      !mongoose.isValidObjectId(payload.sub)
    ) {
      res.status(401).json({
        message: "Invalid token",
      });
      return;
    }

    // Перевірка існування адміністратора в базі даних
    const adminExists = await Admin.exists({
      _id: payload.sub,
    });

    if (!adminExists) {
      res.status(401).json({
        message: "Administrator not found",
      });
      return;
    }

    // Передавання керування захищеному маршруту
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        message: "Invalid or expired token",
      });
      return;
    }

    console.error("Authentication failed:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};
