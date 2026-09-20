import { Router } from "express";
import mongoose from "mongoose";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin";
import { calculateOrderTotal } from "../utils/calculateOrderTotal";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { customerName, customerPhone, pickupTime, items, expectedTotal } =
      req.body ?? {};

    // Перевірка даних клієнта
    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      typeof customerPhone !== "string" ||
      !customerPhone.trim() ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50 ||
      typeof expectedTotal !== "number" ||
      !Number.isFinite(expectedTotal) ||
      expectedTotal < 0
    ) {
      return res.status(400).json({
        message: "Invalid order data",
      });
    }

    // Перевірка часу самовивозу
    if (typeof pickupTime !== "string" || !pickupTime.trim()) {
      return res.status(400).json({
        message: "Invalid pickup time",
      });
    }

    const pickupDate = new Date(pickupTime);

    if (
      Number.isNaN(pickupDate.getTime()) ||
      pickupDate.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        message: "Pickup time must be in the future",
      });
    }

    // Перевірка товарів та їх кількості
    for (const item of items) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.productId !== "string" ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        return res.status(400).json({
          message: "Invalid order item",
        });
      }
    }

    // Обєднання одинакових товарів в замовленні та перевірка кількості
    const quantities = new Map<string, number>();

    for (const item of items) {
      const current = quantities.get(item.productId) ?? 0;
      const next = current + item.quantity;

      if (next > 100) {
        return res.status(400).json({
          message: "Too many items of one product",
        });
      }

      quantities.set(item.productId, next);
    }

    // Отримання актуальний товарів з бази даних
    const products = await Product.find({
      _id: { $in: [...quantities.keys()] },
      isAvailable: true,
    });

    if (products.length !== quantities.size) {
      return res.status(400).json({
        message: "Some products are unavailable or do not exist",
      });
    }

    // Формування замовлення
    const orderItems = products.map((product) => ({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: quantities.get(product._id.toString())!,
    }));

    const totalPrice = calculateOrderTotal(orderItems);

    // Перевірка узгодженої з покупцем вартості замовлення
    if (Math.round(totalPrice * 100) !== Math.round(expectedTotal * 100)) {
      return res.status(409).json({
        message: "ORDER_PRICE_CHANGED",
      });
    }

    // Збереження замовлення
    const order = await Order.create({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      pickupTime: pickupDate,
      items: orderItems,
      totalPrice,
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error("Failed to create order:", error);

    return res.status(500).json({
      message: "Failed to create order",
    });
  }
});

// Отримання списку замовлень для адміністратора
router.get("/", requireAdmin, async (_req, res) => {
  try {
    // Сортування замовлень від найновіших до найстаріших
    const orders = await Order.find().sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error("Failed to fetch orders:", error);

    res.status(500).json({
      message: "Failed to fetch orders",
    });
  }
});

// Дозволені статуси замовлення
const allowedStatuses = ["Нове", "Готується", "Готове", "Виконане"];

// Зміна статусу замовлення адміністратором
router.patch(
  "/:id/status",
  requireTrustedOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body ?? {};

      // Перевірка ідентифікатора замовлення
      if (!mongoose.isValidObjectId(id)) {
        res.status(400).json({
          message: "Invalid order ID",
        });
        return;
      }

      // Перевірка нового статусу
      if (typeof status !== "string" || !allowedStatuses.includes(status)) {
        res.status(400).json({
          message: "Invalid order status",
        });
        return;
      }

      // Оновлення статусу замовлення в базі даних
      const order = await Order.findByIdAndUpdate(
        id,
        { status },
        {
          new: true,
          runValidators: true,
        },
      );

      // Перевірка існування замовлення
      if (!order) {
        res.status(404).json({
          message: "Order not found",
        });
        return;
      }

      // Повернення оновленого замовлення
      res.json(order);
    } catch (error) {
      console.error("Failed to update order status:", error);

      res.status(500).json({
        message: "Failed to update order status",
      });
    }
  },
);
export default router;
