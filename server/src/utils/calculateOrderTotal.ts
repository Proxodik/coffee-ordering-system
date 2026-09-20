interface OrderItemForCalculation {
  price: number;
  quantity: number;
}

// Обчислення загальної вартості замовлення в копійках
export function calculateOrderTotal(items: OrderItemForCalculation[]): number {
  const totalKopecks = items.reduce(
    (total, item) => total + Math.round(item.price * 100) * item.quantity,
    0,
  );

  // Повернення суми у гривнях
  return totalKopecks / 100;
}
