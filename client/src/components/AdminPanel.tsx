import { useCallback, useEffect, useState, type FormEvent } from "react";
import ProductsPanel from "./ProductsPanel";

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  customerName: string;
  customerPhone: string;
  pickupTime: string;
  items: OrderItem[];
  totalPrice: number;
  status: string;
  createdAt: string;
}

const ORDER_STATUSES = ["Нове", "Готується", "Готове", "Виконане"] as const;

export default function AdminPanel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "products">("orders");

  const [loginLoading, setLoginLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [loginError, setLoginError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  // Повернення до форми входу після завершення сесії
  const handleSessionExpired = useCallback(() => {
    setIsLoggedIn(false);
    setOrders([]);
    setPassword("");
    setActiveTab("orders");
    setLoginError("Сеанс завершився. Увійдіть повторно.");
  }, []);

  // Форматування ціни у гривнях
  function formatPrice(price: number) {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
    }).format(price);
  }

  // Форматування дати та часу
  function formatDate(value: string) {
    return new Intl.DateTimeFormat("uk-UA", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  // Перевірка чинної сесії адміністратора після відкриття сторінки
  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch("/api/orders", {
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const data: Order[] = await response.json();

        if (controller.signal.aborted) return;

        setOrders(data);
        setIsLoggedIn(true);
      } catch {
        // Якщо перевірка не вдалася, залишається доступною форма входу.
      } finally {
        if (!controller.signal.aborted) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => controller.abort();
  }, []);

  // Завантаження замовлень
  async function loadOrders() {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const response = await fetch("/api/orders", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        setIsLoggedIn(false);
        setOrders([]);
        throw new Error("Сеанс завершився. Увійдіть повторно.");
      }

      if (!response.ok) {
        throw new Error("Не вдалося завантажити замовлення.");
      }

      const data: Order[] = await response.json();
      setOrders(data);
    } catch (error) {
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Виникла помилка завантаження.",
      );
    } finally {
      setOrdersLoading(false);
    }
  }

  // Авторизація адміністратора
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loginLoading) return;

    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (response.status === 401) {
        throw new Error("Неправильний логін або пароль.");
      }

      if (!response.ok) {
        throw new Error("Не вдалося виконати вхід.");
      }

      setPassword("");
      setIsLoggedIn(true);

      // Після авторизації отримуємо замовлення із сервера
      await loadOrders();
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Виникла помилка авторизації.",
      );
    } finally {
      setLoginLoading(false);
    }
  }

  // Зміна статусу замовлення
  async function updateOrderStatus(orderId: string, newStatus: string) {
    if (updatingOrderId !== null) return;

    setUpdatingOrderId(orderId);
    setOrdersError("");

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (response.status === 401) {
        setIsLoggedIn(false);
        setOrders([]);
        throw new Error("Сеанс завершився. Увійдіть повторно.");
      }

      if (!response.ok) {
        throw new Error("Не вдалося змінити статус замовлення.");
      }

      const updatedOrder: Order = await response.json();

      // Оновлення замовлення після успішної відповіді сервера
      setOrders((previous) =>
        previous.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order,
        ),
      );
    } catch (error) {
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Виникла помилка оновлення статусу.",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Завершення сеансу адміністратора
  async function handleLogout() {
    if (logoutLoading) return;

    setLogoutLoading(true);
    setOrdersError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Не вдалося вийти із системи.");
      }

      setIsLoggedIn(false);
      setOrders([]);
      setUsername("");
      setPassword("");
      setActiveTab("orders");
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Помилка виходу.");
    } finally {
      setLogoutLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <section className="admin-page container">
        <p>Перевірка сесії адміністратора...</p>
      </section>
    );
  }

  // Сторінка авторизації
  if (!isLoggedIn) {
    return (
      <section className="admin-page container">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <h1>Вхід для адміністратора</h1>

          <p>Увійдіть, щоб керувати замовленнями та меню.</p>

          <label htmlFor="admin-username">Логін</label>
          <input
            id="admin-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <label htmlFor="admin-password">Пароль</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {loginError && (
            <p className="error" role="alert">
              {loginError}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={loginLoading}
          >
            {loginLoading ? "Вхід..." : "Увійти"}
          </button>
        </form>
      </section>
    );
  }

  // Панель замовлень
  if (activeTab === "products") {
    return (
      <section className="admin-dashboard container">
        <h1>Панель адміністратора</h1>

        <div className="admin-tabs">
          <button
            className="secondary-action"
            onClick={() => setActiveTab("orders")}
          >
            Замовлення
          </button>

          <button className="admin-tab-active">Товари</button>

          <button
            className="logout-button"
            onClick={handleLogout}
            disabled={logoutLoading}
          >
            {logoutLoading ? "Вихід..." : "Вийти"}
          </button>
        </div>

        {ordersError && (
          <p className="error" role="alert">
            {ordersError}
          </p>
        )}

        <ProductsPanel onSessionExpired={handleSessionExpired} />
      </section>
    );
  }
  return (
    <section className="admin-dashboard container">
      <div className="admin-tabs">
        <button className="admin-tab-active">Замовлення</button>

        <button
          className="secondary-action"
          onClick={() => setActiveTab("products")}
        >
          Товари
        </button>

        <button
          className="logout-button"
          onClick={handleLogout}
          disabled={logoutLoading}
        >
          {logoutLoading ? "Вихід..." : "Вийти"}
        </button>
      </div>
      <div className="admin-dashboard-header">
        <div>
          <h1>Панель адміністратора</h1>
          <p>Перегляд та опрацювання замовлень кав’ярні.</p>
        </div>

        <button
          className="secondary-action"
          onClick={loadOrders}
          disabled={ordersLoading || updatingOrderId !== null}
        >
          {ordersLoading ? "Оновлення..." : "Оновити список"}
        </button>
      </div>

      {ordersError && (
        <p className="error" role="alert">
          {ordersError}
        </p>
      )}

      {ordersLoading && <p>Завантаження замовлень...</p>}

      {!ordersLoading && !ordersError && orders.length === 0 && (
        <div className="admin-empty">
          <p>Замовлень поки немає.</p>
        </div>
      )}

      <div className="admin-orders">
        {orders.map((order) => (
          <article className="admin-order-card" key={order._id}>
            <div className="admin-order-top">
              <div>
                <h2>Замовлення #{order._id.slice(-6)}</h2>
                <p>Створено: {formatDate(order.createdAt)}</p>
              </div>

              <strong>{formatPrice(order.totalPrice)}</strong>
            </div>

            <div className="admin-order-details">
              <p>
                <strong>Клієнт:</strong> {order.customerName}
              </p>

              <p>
                <strong>Телефон:</strong> {order.customerPhone}
              </p>

              <p>
                <strong>Час отримання:</strong> {formatDate(order.pickupTime)}
              </p>
            </div>

            <div className="admin-order-items">
              <h3>Склад замовлення</h3>

              {order.items.map((item) => (
                <div className="admin-order-item" key={item.productId}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>

                  <span>{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="admin-order-footer">
              <label htmlFor={`status-${order._id}`}>Статус замовлення</label>

              <select
                id={`status-${order._id}`}
                value={order.status}
                onChange={(event) =>
                  updateOrderStatus(order._id, event.target.value)
                }
                disabled={updatingOrderId !== null}
              >
                {!ORDER_STATUSES.some((status) => status === order.status) && (
                  <option value={order.status}>{order.status}</option>
                )}

                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              {updatingOrderId === order._id && <span>Збереження...</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
