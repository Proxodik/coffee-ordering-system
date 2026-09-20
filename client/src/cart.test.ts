import { describe, expect, it } from "vitest";
import { synchronizeCart, type Product } from "./cart";

const product: Product = {
  _id: "product-1",
  name: "Кава",
  description: "Тестовий товар",
  price: 50,
  imageUrl: "",
  category: "Напої",
  isAvailable: true,
};

describe("synchronizeCart", () => {
  // Кошик залишається без змін, якщо дані актуальні
  it("зберігає товар з актуальною ціною", () => {
    const result = synchronizeCart([{ product, quantity: 2 }], [product]);

    expect(result.hasPriceChanges).toBe(false);
    expect(result.hasUnavailableItems).toBe(false);
    expect(result.updatedCart[0].product.price).toBe(50);
    expect(result.updatedCart[0].quantity).toBe(2);
  });

  // Оновлення ціни товару
  it("визначає зміну ціни та оновлює кошик", () => {
    const updatedProduct = { ...product, price: 60 };

    const result = synchronizeCart(
      [{ product, quantity: 1 }],
      [updatedProduct],
    );

    expect(result.hasPriceChanges).toBe(true);
    expect(result.updatedCart[0].product.price).toBe(60);
  });

  // Видалення недоступного товару
  it("видаляє товар, якого немає в актуальному меню", () => {
    const result = synchronizeCart([{ product, quantity: 1 }], []);

    expect(result.hasUnavailableItems).toBe(true);
    expect(result.updatedCart).toHaveLength(0);
  });
});
