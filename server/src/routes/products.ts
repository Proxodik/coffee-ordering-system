import { Router } from "express";
import { Product } from "../models/Product";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin";
import { validateProductCreate, validateProductUpdate, validateProductId } from "../middleware/validateProduct";

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
router.post("/", requireTrustedOrigin, requireAdmin, validateProductCreate, async (req, res) => {
  try {
    const { name, description, price, imageUrl, category, isAvailable } =
      req.body ?? {};

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
router.patch("/:id", requireTrustedOrigin, requireAdmin, validateProductId, validateProductUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Дані та ідентифікатор вже перевірено middleware.
    const allowedFields = ["name", "description", "price", "imageUrl", "category", "isAvailable"];

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
router.delete("/:id", requireTrustedOrigin, requireAdmin, validateProductId, async (req, res) => {
  try {
    const { id } = req.params;

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
