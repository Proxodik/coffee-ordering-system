import { describe, expect, it } from "vitest";
import { calculateOrderTotal } from "./calculateOrderTotal";

describe("calculateOrderTotal", () => {
  // Перевірка вартості одного товару
  it("обчислює вартість одного товару", () => {
    const items = [{ price: 50, quantity: 2 }];

    expect(calculateOrderTotal(items)).toBe(100);
  });

  // Перевірка загальної вартості кількох товарів
  it("обчислює вартість кількох товарів", () => {
    const items = [
      { price: 45, quantity: 2 },
      { price: 30, quantity: 1 },
    ];

    expect(calculateOrderTotal(items)).toBe(120);
  });

  // Перевірка порожнього списку товарів
  it("повертає нуль для порожнього списку", () => {
    expect(calculateOrderTotal([])).toBe(0);
  });

  // Перевірка точності обчислення дробових цін
  it("коректно обчислює суму з копійками", () => {
    const items = [
      { price: 0.1, quantity: 1 },
      { price: 0.2, quantity: 1 },
    ];

    expect(calculateOrderTotal(items)).toBe(0.3);
  });

  // Перевірка максимальної дозволеної кількості товару
  it("обчислює вартість 100 одиниць товару", () => {
    const items = [{ price: 25.5, quantity: 100 }];

    expect(calculateOrderTotal(items)).toBe(2550);
  });

  // Перевірка множення ціни з копійками
  it("коректно обчислює вартість кількох одиниць товару", () => {
    const items = [{ price: 19.99, quantity: 3 }];

    expect(calculateOrderTotal(items)).toBe(59.97);
  });
});
