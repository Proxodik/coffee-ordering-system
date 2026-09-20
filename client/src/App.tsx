import { useEffect, useState, type FormEvent } from "react";
import "./App.css";
import AdminPanel from "./components/AdminPanel";

import { synchronizeCart, type Product, type CartItem } from "./cart";

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Усі");
  const [currentPage, setCurrentPage] = useState<
    "menu" | "cart" | "checkout" | "success" | "admin"
  >("menu");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");

  const [createdOrder, setCreatedOrder] = useState<{
    _id: string;
    totalPrice: number;
    status: string;
  } | null>(null);

  // Завантаження товарів із серверної частини
  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const response = await fetch("/api/products", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Не вдалося завантажити меню");
        }

        const data: Product[] = await response.json();
        setProducts(data);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(err instanceof Error ? err.message : "Невідома помилка");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => controller.abort();
  }, []);

  // Додавання товару до кошика
  function addToCart(product: Product) {
    setCart((previous) => {
      const existing = previous.find(
        (item) => item.product._id === product._id,
      );

      if (existing) {
        return previous.map((item) =>
          item.product._id === product._id
            ? { ...item, quantity: Math.min(item.quantity + 1, 100) }
            : item,
        );
      }

      return [...previous, { product, quantity: 1 }];
    });
  }

  // Зміна кількості товару
  function changeQuantity(productId: string, change: number) {
    setCart((previous) =>
      previous
        .map((item) =>
          item.product._id === productId
            ? {
                ...item,
                quantity: Math.max(0, Math.min(100, item.quantity + change)),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  // Видалення товару з кошика
  function removeFromCart(productId: string) {
    setCart((previous) =>
      previous.filter((item) => item.product._id !== productId),
    );
  }

  // Розрахунок кількості товарів та загальної вартості
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const totalPrice = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  // Формування категорій та фільтрація меню
  const categories = [
    "Усі",
    ...new Set(products.map((product) => product.category)),
  ];

  const visibleProducts =
    selectedCategory === "Усі"
      ? products
      : products.filter((product) => product.category === selectedCategory);

  // Форматування вартості у гривнях
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
    }).format(price);

  // Надсилання замовлення на сервер
  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    setOrderError("");

    // Перевірка наявності товарів у кошику
    if (cart.length === 0) {
      setOrderError("Ваш кошик порожній.");
      return;
    }

    // Перевірка контактних даних
    if (!customerName.trim() || !customerPhone.trim()) {
      setOrderError("Заповніть усі обов'язкові поля.");
      return;
    }

    // Перевірка часу отримання
    const selectedDate = new Date(pickupTime);

    if (
      !pickupTime ||
      Number.isNaN(selectedDate.getTime()) ||
      selectedDate.getTime() <= Date.now()
    ) {
      setOrderError("Оберіть майбутню дату та час отримання.");
      return;
    }

    setSubmitting(true);

    try {
      // Перевірка актуальності товарів перед оформленням замовлення
      const productsResponse = await fetch("/api/products");

      if (!productsResponse.ok) {
        throw new Error(
          "Не вдалося перевірити актуальність кошика. Спробуйте ще раз.",
        );
      }

      const actualProducts: Product[] = await productsResponse.json();

      // Оновлення меню відповідно до даних сервера
      setProducts(actualProducts);

      // Перевірка змін у кошику
      const { updatedCart, hasUnavailableItems, hasPriceChanges } =
        synchronizeCart(cart, actualProducts);

      if (hasUnavailableItems || hasPriceChanges) {
        setCart(updatedCart);

        if (hasUnavailableItems) {
          setOrderError(
            "Деякі товари більше недоступні та були видалені з кошика. " +
              "Перевірте замовлення перед повторним підтвердженням.",
          );

          // Повернення до кошика після видалення недоступних товарів
          setCurrentPage("cart");
        } else {
          setOrderError(
            "Ціни товарів змінилися. Перевірте оновлену суму " +
              "та підтвердьте замовлення повторно.",
          );
        }

        return;
      }
      // Формування замовлення відповідно до API
      const orderData = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        pickupTime: selectedDate.toISOString(),
        expectedTotal: Math.round(totalPrice * 100) / 100,
        items: cart.map((item) => ({
          productId: item.product._id,
          quantity: item.quantity,
        })),
      };

      // Надсилання замовлення
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        if (
          response.status === 409 &&
          errorData?.message === "ORDER_PRICE_CHANGED"
        ) {
          throw new Error(
            "Ціна замовлення змінилася під час оформлення. " +
              "Натисніть підтвердження ще раз, щоб оновити суму.",
          );
        }
        if (
          errorData?.message === "Some products are unavailable or do not exist"
        ) {
          throw new Error(
            "Один або декілька товарів більше недоступні. " +
              "Поверніться до кошика та перевірте замовлення.",
          );
        }

        if (errorData?.message === "Pickup time must be in the future") {
          throw new Error("Оберіть майбутню дату та час отримання.");
        }

        throw new Error(
          "Не вдалося оформити замовлення. Перевірте дані та спробуйте ще раз.",
        );
      }

      const result = await response.json();

      // Збереження результату та очищення кошика
      setCreatedOrder(result);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setPickupTime("");

      setCurrentPage("success");
    } catch (error) {
      setOrderError(
        error instanceof Error
          ? error.message
          : "Виникла помилка під час оформлення замовлення.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="header">
        <div className="container header-content">
          <button
            className="logo logo-button"
            onClick={() => setCurrentPage("menu")}
          >
            ☕ <span>Brew & Bite</span>
          </button>

          <button
            className="cart-navigation"
            onClick={() => setCurrentPage("cart")}
          >
            🛒 Кошик ({cartCount})
          </button>
          <button
            className="admin-navigation"
            onClick={() => setCurrentPage("admin")}
          >
            Адміністратор
          </button>
        </div>
      </header>

      <main>
        {currentPage === "admin" ? (
          <AdminPanel />
        ) : currentPage === "menu" ? (
          <>
            <section className="hero">
              <div className="container">
                <h1>
                  Більше, ніж кава.
                  <br />
                  Це твій настрій.
                </h1>

                <p>Ароматні напої, смачні десерти та затишна атмосфера.</p>

                <a href="#menu" className="hero-button">
                  Переглянути меню ↓
                </a>
              </div>
            </section>

            <section id="menu" className="menu-section container">
              <h2>Наше меню</h2>

              {loading && <p>Завантаження меню...</p>}

              {error && <p className="error">{error}</p>}

              {!loading && !error && (
                <>
                  <div className="categories">
                    {categories.map((category) => (
                      <button
                        key={category}
                        className={
                          selectedCategory === category
                            ? "category active"
                            : "category"
                        }
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  <div className="product-grid">
                    {visibleProducts.map((product) => (
                      <article className="product-card" key={product._id}>
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="product-image"
                          />
                        ) : (
                          <div className="product-placeholder">☕</div>
                        )}

                        <div className="product-info">
                          <h3>{product.name}</h3>
                          <p>{product.description}</p>

                          <div className="product-bottom">
                            <strong>{formatPrice(product.price)}</strong>

                            <button
                              className="add-button"
                              onClick={() => addToCart(product)}
                              aria-label={`Додати ${product.name} до кошика`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {visibleProducts.length === 0 && (
                    <p>У цій категорії поки немає товарів.</p>
                  )}
                </>
              )}
            </section>
          </>
        ) : currentPage === "cart" ? (
          <section className="cart-section container">
            <button
              className="back-button"
              onClick={() => setCurrentPage("menu")}
            >
              ← Повернутися до меню
            </button>

            <h1>Ваш кошик</h1>
            {orderError && (
              <p className="error" role="alert">
                {orderError}
              </p>
            )}
            {cart.length === 0 ? (
              <div className="empty-cart">
                <p>Ваш кошик поки порожній.</p>

                <button
                  className="primary-button"
                  onClick={() => setCurrentPage("menu")}
                >
                  Переглянути меню
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <article className="cart-item" key={item.product._id}>
                      <div className="cart-product">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="cart-image"
                          />
                        ) : (
                          <div className="cart-image cart-placeholder">☕</div>
                        )}

                        <div>
                          <h3>{item.product.name}</h3>
                          <p>{formatPrice(item.product.price)}</p>
                        </div>
                      </div>

                      <div className="quantity-controls">
                        <button
                          onClick={() => changeQuantity(item.product._id, -1)}
                          aria-label={`Зменшити кількість ${item.product.name}`}
                        >
                          −
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          onClick={() => changeQuantity(item.product._id, 1)}
                          disabled={item.quantity >= 100}
                          aria-label={`Збільшити кількість ${item.product.name}`}
                        >
                          +
                        </button>
                      </div>

                      <strong>
                        {formatPrice(item.product.price * item.quantity)}
                      </strong>

                      <button
                        className="remove-button"
                        onClick={() => removeFromCart(item.product._id)}
                        aria-label={`Видалити ${item.product.name}`}
                      >
                        Видалити
                      </button>
                    </article>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="cart-total">
                    <span>Разом до оплати</span>
                    <strong>{formatPrice(totalPrice)}</strong>
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => {
                      setOrderError("");
                      setCurrentPage("checkout");
                    }}
                  >
                    Оформити замовлення
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => setCurrentPage("menu")}
                  >
                    Продовжити покупки
                  </button>
                </div>
              </>
            )}
          </section>
        ) : currentPage === "checkout" ? (
          <section className="checkout-section container">
            <button
              className="back-button"
              onClick={() => setCurrentPage("cart")}
            >
              ← Повернутися до кошика
            </button>

            <h1>Оформлення замовлення</h1>

            <div className="checkout-layout">
              <form className="checkout-form" onSubmit={submitOrder}>
                <h2>Контактні дані</h2>

                <label htmlFor="customer-name">Ваше ім'я</label>

                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Введіть ваше ім'я"
                  autoComplete="name"
                  required
                />

                <label htmlFor="customer-phone">Номер телефону</label>

                <input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="+380..."
                  autoComplete="tel"
                  required
                />

                <label htmlFor="pickup-time">Дата та час отримання</label>

                <input
                  id="pickup-time"
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(event) => setPickupTime(event.target.value)}
                  required
                />

                {orderError && (
                  <p className="error" role="alert">
                    {orderError}
                  </p>
                )}

                <button
                  className="primary-button"
                  type="submit"
                  disabled={submitting || cart.length === 0}
                >
                  {submitting ? "Оформлення..." : "Підтвердити замовлення"}
                </button>
              </form>

              <aside className="checkout-summary">
                <h2>Ваше замовлення</h2>

                {cart.map((item) => (
                  <div className="checkout-summary-item" key={item.product._id}>
                    <span>
                      {item.product.name} × {item.quantity}
                    </span>

                    <strong>
                      {formatPrice(item.product.price * item.quantity)}
                    </strong>
                  </div>
                ))}

                <div className="checkout-total">
                  <span>Разом</span>
                  <strong>{formatPrice(totalPrice)}</strong>
                </div>

                <p className="checkout-note">
                  Оплата здійснюється під час отримання.
                </p>
              </aside>
            </div>
          </section>
        ) : (
          <section className="success-section container">
            <div className="success-card">
              <div className="success-icon">✓</div>

              <h1>Замовлення успішно оформлено!</h1>

              <p>Дякуємо! Ваше замовлення передано кав'ярні.</p>

              {createdOrder && (
                <>
                  <p>
                    Номер замовлення:
                    <br />
                    <strong>{createdOrder._id}</strong>
                  </p>

                  <p>
                    Сума:{" "}
                    <strong>{formatPrice(createdOrder.totalPrice)}</strong>
                  </p>

                  <p>
                    Статус: <strong>{createdOrder.status}</strong>
                  </p>
                </>
              )}

              <button
                className="primary-button"
                onClick={() => setCurrentPage("menu")}
              >
                Повернутися до меню
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

export default App;
