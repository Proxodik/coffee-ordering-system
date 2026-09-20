import { RequestHandler } from "express";

export const requireTrustedOrigin: RequestHandler = (req, res, next) => {
  // Визначення дозволеного джерела запитів
  const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5000";

  // Отримання джерела поточного запиту
  const origin = req.get("Origin");

  // Відхилення запитів із невідомого джерела
  if (origin !== allowedOrigin) {
    res.status(403).json({
      message: "Invalid request origin",
    });
    return;
  }

  next();
};
