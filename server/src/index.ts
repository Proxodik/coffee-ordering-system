import "dotenv/config";
import express from "express";
import { connectDatabase } from "./config/database";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import authRouter from "./routes/auth";
import cookieParser from "cookie-parser";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(express.json());
app.use(cookieParser());
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/auth", authRouter);

app.get("/", (_req, res) => {
  res.json({
    message: "Coffee Ordering System API is running",
  });
});

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
