import { useEffect, useState, type FormEvent } from "react";

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  isAvailable: boolean;
}

interface ProductForm {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  category: string;
  isAvailable: boolean;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  category: "",
  isAvailable: true,
};

interface ProductsPanelProps {
  onSessionExpired: () => void;
}

export default function ProductsPanel({
  onSessionExpired,
}: ProductsPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Форматування вартості у гривнях
  function formatPrice(price: number) {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
    }).format(price);
  }

  // Отримання повного списку товарів
  async function loadProducts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/products/admin", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        onSessionExpired();
        throw new Error("Сеанс завершився. Увійдіть повторно.");
      }

      if (!response.ok) {
        throw new Error("Не вдалося завантажити товари.");
      }

      const data: Product[] = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка завантаження.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  // Оновлення значень форми
  function updateForm<K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  // Підготовка товару до редагування
  function startEditing(product: Product) {
    setEditingId(product._id);

    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      imageUrl: product.imageUrl,
      category: product.category,
      isAvailable: product.isAvailable,
    });

    setError("");
    setMessage("");

    document.getElementById("product-form")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  // Скасування редагування
  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  // Створення або редагування товару
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setMessage("");

    const price = Number(form.price);

    if (
      !form.name.trim() ||
      !form.category.trim() ||
      form.price.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      setError("Перевірте назву, категорію та ціну товару.");
      return;
    }

    setSaving(true);

    const productData = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      imageUrl: form.imageUrl.trim(),
      category: form.category.trim(),
      isAvailable: form.isAvailable,
    };

    try {
      const url = editingId ? `/api/products/${editingId}` : "/api/products";

      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      if (response.status === 401) {
        onSessionExpired();
        throw new Error("Сеанс завершився. Увійдіть повторно.");
      }

      if (!response.ok) {
        throw new Error("Не вдалося зберегти товар.");
      }

      const savedProduct: Product = await response.json();

      if (editingId) {
        setProducts((previous) =>
          previous.map((product) =>
            product._id === savedProduct._id ? savedProduct : product,
          ),
        );
      } else {
        setProducts((previous) => [savedProduct, ...previous]);
      }

      resetForm();
      setMessage("Товар успішно збережено.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка збереження.");
    } finally {
      setSaving(false);
    }
  }

  // Видалення товару після підтвердження
  async function deleteProduct(product: Product) {
    if (deletingId !== null || saving) return;

    const confirmed = window.confirm(`Видалити товар «${product.name}»?`);

    if (!confirmed) return;

    setError("");
    setMessage("");
    setDeletingId(product._id);

    try {
      const response = await fetch(`/api/products/${product._id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (response.status === 401) {
        onSessionExpired();
        throw new Error("Сеанс завершився. Увійдіть повторно.");
      }

      if (!response.ok) {
        throw new Error("Не вдалося видалити товар.");
      }

      setProducts((previous) =>
        previous.filter((item) => item._id !== product._id),
      );

      if (editingId === product._id) {
        resetForm();
      }

      setMessage("Товар видалено.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка видалення.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="products-panel">
      <form id="product-form" className="product-editor" onSubmit={saveProduct}>
        <h2>{editingId ? "Редагування товару" : "Новий товар"}</h2>

        <div className="product-form-grid">
          <label>
            Назва
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              required
            />
          </label>

          <label>
            Категорія
            <input
              value={form.category}
              onChange={(event) => updateForm("category", event.target.value)}
              required
            />
          </label>

          <label>
            Ціна, ₴
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => updateForm("price", event.target.value)}
              required
            />
          </label>

          <label>
            Посилання на зображення
            <input
              type="url"
              value={form.imageUrl}
              onChange={(event) => updateForm("imageUrl", event.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>

        <label>
          Опис
          <textarea
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            rows={3}
          />
        </label>

        <label className="availability-label">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={(event) =>
              updateForm("isAvailable", event.target.checked)
            }
          />
          Доступний у меню
        </label>

        <div className="product-form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={saving || deletingId !== null}
          >
            {saving ? "Збереження..." : "Зберегти товар"}
          </button>

          {editingId && (
            <button
              className="secondary-action"
              type="button"
              onClick={resetForm}
              disabled={saving}
            >
              Скасувати
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}

      <div className="products-list-header">
        <h2>Список товарів</h2>

        <button
          className="secondary-action"
          onClick={loadProducts}
          disabled={loading || saving || deletingId !== null}
        >
          Оновити список
        </button>
      </div>

      {loading && <p>Завантаження товарів...</p>}

      {!loading && products.length === 0 && <p>Товарів поки немає.</p>}

      <div className="admin-products-grid">
        {products.map((product) => (
          <article className="admin-product-card" key={product._id}>
            <div>
              <h3>{product.name}</h3>
              <p>{product.category}</p>
              <strong>{formatPrice(product.price)}</strong>

              <p>
                {product.isAvailable
                  ? "Доступний у меню"
                  : "Прихований із меню"}
              </p>
            </div>

            <div className="admin-product-actions">
              <button
                className="secondary-action"
                onClick={() => startEditing(product)}
                disabled={saving || deletingId !== null}
              >
                Редагувати
              </button>

              <button
                className="delete-product-button"
                onClick={() => deleteProduct(product)}
                disabled={saving || deletingId !== null}
              >
                {deletingId === product._id ? "Видалення..." : "Видалити"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
