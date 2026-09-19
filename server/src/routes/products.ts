import { Router } from "express";
import { Product } from "../models/Product";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin";
import mongoose from "mongoose";

const router = Router();

// Получение доступных товаров из меню
router.get("/", async (_req, res) => {
  try {
    const products = await Product.find({ isAvailable: true });

    res.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);

    res.status(500).json({
      message: "Failed to fetch products",
    });
  }
});

// Отримання всіх товарів для адміністратора, включно з прихованими
router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error("Failed to fetch admin products:", error);

    res.status(500).json({
      message: "Failed to fetch products",
    });
  }
});

// Створення нового товару адміністратором
router.post("/", requireTrustedOrigin, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, imageUrl, category, isAvailable } =
      req.body ?? {};

    // Перевірка обов'язкових полів
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      res.status(400).json({
        message: "Invalid product data",
      });
      return;
    }

    // Перевірка необов'язкових полів
    if (
      (description !== undefined && typeof description !== "string") ||
      (imageUrl !== undefined && typeof imageUrl !== "string") ||
      (isAvailable !== undefined && typeof isAvailable !== "boolean")
    ) {
      res.status(400).json({
        message: "Invalid optional product fields",
      });
      return;
    }

    // Створення товару в базі даних
    const product = await Product.create({
      name: name.trim(),
      description: description ?? "",
      price,
      imageUrl: imageUrl ?? "",
      category: category.trim(),
      isAvailable: isAvailable ?? true,
    });

    // Повернення створеного товару
    res.status(201).json(product);
  } catch (error) {
    console.error("Failed to create product:", error);

    res.status(500).json({
      message: "Failed to create product",
    });
  }
});

// Редагування товару адміністратором
router.patch("/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Перевірка ідентифікатора товару
    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({
        message: "Invalid product ID",
      });
      return;
    }

    // Перевірка формату даних
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      res.status(400).json({
        message: "Invalid product data",
      });
      return;
    }

    // Перевірка дозволених полів
    const allowedFields = [
      "name",
      "description",
      "price",
      "imageUrl",
      "category",
      "isAvailable",
    ];

    const fields = Object.keys(data);

    if (
      fields.length === 0 ||
      fields.some((field) => !allowedFields.includes(field))
    ) {
      res.status(400).json({
        message: "Invalid product fields",
      });
      return;
    }

    // Перевірка текстових полів
    for (const field of ["name", "category"]) {
      if (
        field in data &&
        (typeof data[field] !== "string" || !data[field].trim())
      ) {
        res.status(400).json({
          message: `Invalid ${field}`,
        });
        return;
      }
    }

    for (const field of ["description", "imageUrl"]) {
      if (field in data && typeof data[field] !== "string") {
        res.status(400).json({
          message: `Invalid ${field}`,
        });
        return;
      }
    }

    // Перевірка ціни та доступності
    if (
      "price" in data &&
      (typeof data.price !== "number" ||
        !Number.isFinite(data.price) ||
        data.price < 0)
    ) {
      res.status(400).json({
        message: "Invalid price",
      });
      return;
    }

    if ("isAvailable" in data && typeof data.isAvailable !== "boolean") {
      res.status(400).json({
        message: "Invalid availability value",
      });
      return;
    }

    // Формування оновлення лише з дозволених полів
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates[field] =
          field === "name" || field === "category"
            ? data[field].trim()
            : data[field];
      }
    }

    // Оновлення товару в базі даних
    const product = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!product) {
      res.status(404).json({
        message: "Product not found",
      });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);

    res.status(500).json({
      message: "Failed to update product",
    });
  }
});

// Видалення товару адміністратором
router.delete("/:id", requireTrustedOrigin, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Перевірка ідентифікатора товару
    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({
        message: "Invalid product ID",
      });
      return;
    }

    // Пошук і видалення товару
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      res.status(404).json({
        message: "Product not found",
      });
      return;
    }

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete product:", error);

    res.status(500).json({
      message: "Failed to delete product",
    });
  }
});
export default router;
