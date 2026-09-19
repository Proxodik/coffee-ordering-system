import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/Admin";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin";

const router = Router();

// Авторизація адміністратора
router.post("/login", requireTrustedOrigin, async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    // Перевірка вхідних даних
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    // Пошук адміністратора разом із хешем пароля
    const admin = await Admin.findOne({
      username: username.trim(),
    }).select("+passwordHash");

    // Перевірка пароля без розкриття причини помилки
    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Перевірка секретного ключа для створення JWT
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    // Створення токена з ідентифікатором адміністратора
    const token = jwt.sign({ role: "admin" }, jwtSecret, {
      subject: admin._id.toString(),
      expiresIn: "2h",
    });

    // Збереження токена в HttpOnly-cookie
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api",
      maxAge: 2 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Login successful",
      admin: {
        id: admin._id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Вихід адміністратора із системи
// Вихід адміністратора із системи
router.post("/logout", requireTrustedOrigin, (_req, res) => {
  // Видалення cookie авторизації
  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
  });

  res.json({
    message: "Logout successful",
  });
});
export default router;
