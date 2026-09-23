import { RequestHandler } from "express";
import mongoose from "mongoose";

// Перевірка даних до виконання бізнес-логіки створення замовлення.
export function getOrderValidationError(body: unknown, now = Date.now()): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid order data";
  }

  const { customerName, customerPhone, pickupTime, items, expectedTotal } =
    body as Record<string, unknown>;

  if (
    typeof customerName !== "string" || !customerName.trim() ||
    typeof customerPhone !== "string" || !customerPhone.trim() ||
    !Array.isArray(items) || items.length === 0 || items.length > 50 ||
    typeof expectedTotal !== "number" || !Number.isFinite(expectedTotal) || expectedTotal < 0
  ) {
    return "Invalid order data";
  }

  if (typeof pickupTime !== "string" || !pickupTime.trim()) {
    return "Invalid pickup time";
  }

  const pickupDate = new Date(pickupTime);
  if (Number.isNaN(pickupDate.getTime()) || pickupDate.getTime() <= now) {
    return "Pickup time must be in the future";
  }

  const quantities = new Map<string, number>();
  for (const item of items) {
    if (
      !item || typeof item !== "object" || Array.isArray(item) ||
      typeof item.productId !== "string" || !mongoose.isValidObjectId(item.productId) ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100
    ) {
      return "Invalid order item";
    }

    const next = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (next > 100) {
      return "Too many items of one product";
    }
    quantities.set(item.productId, next);
  }

  return null;
}

export const validateOrder: RequestHandler = (req, res, next) => {
  const message = getOrderValidationError(req.body);
  if (message) {
    res.status(400).json({ message });
    return;
  }
  next();
};

export const validateOrderId: RequestHandler = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }
  next();
};

const allowedStatuses = ["Нове", "Готується", "Готове", "Виконане"];

export const validateOrderStatus: RequestHandler = (req, res, next) => {
  if (typeof req.body?.status !== "string" || !allowedStatuses.includes(req.body.status)) {
    res.status(400).json({ message: "Invalid order status" });
    return;
  }
  next();
};
