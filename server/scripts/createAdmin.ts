import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "../src/config/database";
import { Admin } from "../src/models/Admin";

async function createAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  // Перевірка наявності облікових даних
  if (!username || !password || password.length < 12) {
    throw new Error(
      "Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 12 characters)",
    );
  }

  try {
    // Підключення до бази даних
    await connectDatabase();

    // Перевірка, чи існує адміністратор із таким іменем
    const existingAdmin = await Admin.findOne({ username });

    if (existingAdmin) {
      console.log("Administrator already exists");
      return;
    }

    // Хешування пароля перед збереженням
    const passwordHash = await bcrypt.hash(password, 12);

    // Створення облікового запису адміністратора
    await Admin.create({
      username,
      passwordHash,
    });

    console.log("Administrator created successfully");
  } finally {
    // Закриття з'єднання з базою даних
    await mongoose.disconnect();
  }
}

createAdmin().catch((error) => {
  console.error("Failed to create administrator:", error);
  process.exitCode = 1;
});
