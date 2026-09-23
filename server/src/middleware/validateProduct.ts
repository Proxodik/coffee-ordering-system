import { RequestHandler } from "express";
import mongoose from "mongoose";

const fields = ["name", "description", "price", "imageUrl", "category", "isAvailable"];

export function getProductValidationError(body: unknown, partial = false): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid product data";
  }
  const data = body as Record<string, unknown>;
  const keys = Object.keys(data);
  if (partial && (keys.length === 0 || keys.some((key) => !fields.includes(key)))) {
    return "Invalid product fields";
  }

  if (!partial && (
    typeof data.name !== "string" || !data.name.trim() ||
    typeof data.category !== "string" || !data.category.trim() ||
    typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0
  )) {
    return "Invalid product data";
  }

  for (const key of ["name", "category"]) {
    if (key in data && (typeof data[key] !== "string" || !(data[key] as string).trim())) {
      return partial ? `Invalid ${key}` : "Invalid product data";
    }
  }
  for (const key of ["description", "imageUrl"]) {
    if (key in data && typeof data[key] !== "string") {
      return partial ? `Invalid ${key}` : "Invalid optional product fields";
    }
  }
  if ("price" in data && (
    typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0
  )) {
    return partial ? "Invalid price" : "Invalid product data";
  }
  if ("isAvailable" in data && typeof data.isAvailable !== "boolean") {
    return partial ? "Invalid availability value" : "Invalid optional product fields";
  }
  return null;
}

export const validateProductCreate: RequestHandler = (req, res, next) => {
  const message = getProductValidationError(req.body);
  if (message) { res.status(400).json({ message }); return; }
  next();
};

export const validateProductUpdate: RequestHandler = (req, res, next) => {
  const message = getProductValidationError(req.body, true);
  if (message) { res.status(400).json({ message }); return; }
  next();
};

export const validateProductId: RequestHandler = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "Invalid product ID" });
    return;
  }
  next();
};
