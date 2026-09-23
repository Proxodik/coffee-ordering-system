import { describe, expect, it } from "vitest";
import { getOrderValidationError } from "./validateOrder";
import { getProductValidationError } from "./validateProduct";

const id = "507f1f77bcf86cd799439011";
const now = Date.parse("2026-09-22T12:00:00.000Z");
const order = {
  customerName: "Ілля",
  customerPhone: "+380501112233",
  pickupTime: "2026-09-22T13:00:00.000Z",
  items: [{ productId: id, quantity: 2 }],
  expectedTotal: 120,
};

describe("валідація замовлень", () => {
  it("приймає коректне замовлення", () => {
    expect(getOrderValidationError(order, now)).toBeNull();
  });

  it("відхиляє минулий час отримання", () => {
    expect(getOrderValidationError({ ...order, pickupTime: "2026-09-22T11:00:00.000Z" }, now))
      .toBe("Pickup time must be in the future");
  });

  it("відхиляє некоректний ідентифікатор товару", () => {
    expect(getOrderValidationError({ ...order, items: [{ productId: "wrong", quantity: 1 }] }, now))
      .toBe("Invalid order item");
  });

  it("обмежує сумарну кількість дубльованих позицій", () => {
    expect(getOrderValidationError({ ...order, items: [
      { productId: id, quantity: 60 },
      { productId: id, quantity: 50 },
    ] }, now)).toBe("Too many items of one product");
  });
});

describe("валідація товарів", () => {
  it("приймає коректний товар", () => {
    expect(getProductValidationError({ name: "Кава", category: "Напої", price: 60 })).toBeNull();
  });

  it("відхиляє від’ємну ціну", () => {
    expect(getProductValidationError({ name: "Кава", category: "Напої", price: -1 }))
      .toBe("Invalid product data");
  });

  it("відхиляє недозволені поля оновлення", () => {
    expect(getProductValidationError({ unexpected: true }, true)).toBe("Invalid product fields");
  });

  it("приймає часткове оновлення дозволеного поля", () => {
    expect(getProductValidationError({ isAvailable: false }, true)).toBeNull();
  });
});
