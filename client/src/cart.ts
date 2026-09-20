export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  isAvailable: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartSyncResult {
  updatedCart: CartItem[];
  hasUnavailableItems: boolean;
  hasPriceChanges: boolean;
}

// Синхронізація кошика з актуальними даними про товари
export function synchronizeCart(
  cart: CartItem[],
  actualProducts: Product[],
): CartSyncResult {
  const actualProductsMap = new Map(
    actualProducts.map((product) => [product._id, product]),
  );

  const updatedCart: CartItem[] = [];
  let hasUnavailableItems = false;
  let hasPriceChanges = false;

  for (const item of cart) {
    const actualProduct = actualProductsMap.get(item.product._id);

    if (!actualProduct) {
      hasUnavailableItems = true;
      continue;
    }

    if (actualProduct.price !== item.product.price) {
      hasPriceChanges = true;
    }

    updatedCart.push({
      ...item,
      product: actualProduct,
    });
  }

  return {
    updatedCart,
    hasUnavailableItems,
    hasPriceChanges,
  };
}
