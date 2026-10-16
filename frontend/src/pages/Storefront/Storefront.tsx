import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_URL } from "../../api/config";
import { addToCart, clearCart, readCart, updateCartQuantity, type CartItem } from "../../api/cart";
import { getImageUrl } from "../../api/products";
import type { ProductData } from "../../components/ContentRenderer/BuilderRenderer";
import BuilderRenderer from "../../components/ContentRenderer/BuilderRenderer";
import { fetchActiveTemplate, type TemplateType } from "../../api/templates";

export type StorefrontPage = "shop" | "cart" | "checkout" | "received" | "account";
interface OrderReceipt {
  order_number: string;
  total: number;
  payment_status?: string;
}

interface OrderLookupResult extends OrderReceipt {
  status: string;
  payment_status: string;
  items: { name: string; quantity: number; unit_price: number }[];
}

interface CheckoutResponse extends OrderReceipt {
  id: string;
  razorpay?: {
    key_id: string;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
  };
}

interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: { error?: { description?: string } }) => void) => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
}

const money = (amount: number) => `₹${Number(amount || 0).toFixed(2)}`;

const loadRazorpay = async (): Promise<new (options: RazorpayOptions) => RazorpayInstance> => {
  const existing = (window as Window & { Razorpay?: new (options: RazorpayOptions) => RazorpayInstance }).Razorpay;
  if (existing) return existing;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded."));
    document.body.appendChild(script);
  });

  const Razorpay = (window as Window & { Razorpay?: new (options: RazorpayOptions) => RazorpayInstance }).Razorpay;
  if (!Razorpay) throw new Error("Razorpay checkout is unavailable.");
  return Razorpay;
};

const templateTypes: Partial<Record<StorefrontPage, TemplateType>> = {
  shop: "shop",
  cart: "cart",
  checkout: "checkout",
  account: "my_account",
  received: "order_received",
};

const Storefront = ({
  page,
  embedded = false,
}: {
  page: StorefrontPage;
  embedded?: boolean;
}) => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loadError, setLoadError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [pageNumber, setPageNumber] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "bank_transfer" | "razorpay">("cash_on_delivery");
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<{
    path: string;
    type: TemplateType;
    template: NonNullable<Awaited<ReturnType<typeof fetchActiveTemplate>>>;
  } | null>(null);
  const [lookupOrderNumber, setLookupOrderNumber] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<OrderLookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [cartError, setCartError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const receipt = location.state as OrderReceipt | null;

  useEffect(() => {
    const templateType = templateTypes[page];
    if (embedded || !templateType) return;
    let active = true;
    fetchActiveTemplate(templateType, location.pathname)
      .then((template) => {
        if (active && template) {
          setActiveTemplate({ path: location.pathname, type: templateType, template });
        }
      })
      .catch((error) => {
        console.error(`Unable to load ${templateType} storefront template:`, error);
      });
    return () => {
      active = false;
    };
  }, [page, location.pathname, embedded]);

  useEffect(() => {
    axios.get<{ enabled: boolean }>(`${API_URL}/api/settings/payments/public`)
      .then(({ data }) => setRazorpayEnabled(Boolean(data.enabled)))
      .catch((error) => {
        console.error("Unable to load payment methods:", error);
        setRazorpayEnabled(false);
      });
  }, []);

  useEffect(() => {
    const update = () => {
      try {
        setCart(readCart());
        setCartError("");
      } catch (error) {
        console.error("Unable to refresh cart contents:", error);
        setCartError("Saved cart data could not be read. Clear the site cart storage and try again.");
      }
    };
    update();
    window.addEventListener("store-cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("store-cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  useEffect(() => {
    if (page !== "shop") return;
    let active = true;
    axios.get<{ products: ProductData[] }>(`${API_URL}/api/public/products`, { params: { limit: 100 } })
      .then(({ data }) => {
        if (active) setProducts(Array.isArray(data.products) ? data.products : []);
      })
      .catch((error) => {
        console.error("Unable to load shop products:", error);
        if (active) setLoadError("Products could not be loaded. Please try again later.");
      });
    return () => {
      active = false;
    };
  }, [page]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))),
    [products],
  );
  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return products
      .filter((product) => (!category || product.category === category))
      .filter((product) => !normalizedSearch || product.title.toLowerCase().includes(normalizedSearch))
      .sort((a, b) => sort === "price-low"
        ? a.price - b.price
        : sort === "price-high"
          ? b.price - a.price
          : sort === "newest"
            ? b.id.localeCompare(a.id)
            : a.title.localeCompare(b.title));
  }, [products, search, category, sort]);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = filteredProducts.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const submitCheckout = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setCheckoutError("");
    try {
      const { data } = await axios.post<CheckoutResponse>(`${API_URL}/api/public/checkout`, {
        customer_name: customerName,
        email,
        phone,
        address,
        payment_method: paymentMethod,
        items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      });
      if (data.razorpay) {
        const Razorpay = await loadRazorpay();
        await new Promise<void>((resolve, reject) => {
          const checkout = new Razorpay({
            key: data.razorpay!.key_id,
            amount: data.razorpay!.amount,
            currency: data.razorpay!.currency,
            name: data.razorpay!.name,
            order_id: data.razorpay!.order_id,
            prefill: { name: customerName, email, contact: phone },
            handler: async (payment) => {
              try {
                const { data: confirmedOrder } = await axios.post<CheckoutResponse>(`${API_URL}/api/public/payments/verify`, {
                  order_id: data.id,
                  razorpay_order_id: payment.razorpay_order_id,
                  razorpay_payment_id: payment.razorpay_payment_id,
                  razorpay_signature: payment.razorpay_signature,
                });
                clearCart();
                navigate("/order-received", { replace: true, state: confirmedOrder });
                resolve();
              } catch (verificationError) {
                reject(verificationError);
              }
            },
            modal: {
              ondismiss: () => {
                void axios.post(`${API_URL}/api/public/payments/fail/${data.id}`)
                  .catch((failureError) => console.error("Unable to record closed payment:", failureError));
                setCheckoutError("Payment was cancelled. You can try again.");
                resolve();
              },
            },
          });
          checkout.on("payment.failed", (failure) => {
            void axios.post(`${API_URL}/api/public/payments/fail/${data.id}`)
              .catch((failureError) => console.error("Unable to record failed payment:", failureError));
            reject(new Error(failure.error?.description || "Payment failed. Please try again."));
          });
          checkout.open();
        });
        return;
      }
      clearCart();
      navigate("/order-received", { replace: true, state: data });
    } catch (error) {
      console.error("Checkout failed:", error);
      setCheckoutError(
        axios.isAxiosError(error)
          ? String(error.response?.data?.detail || "Checkout could not be completed.")
          : "Checkout could not be completed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const lookupOrder = async (event: FormEvent) => {
    event.preventDefault();
    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);
    try {
      const response = await axios.get<OrderLookupResult>(
        `${API_URL}/api/public/orders/lookup`,
        { params: { order_number: lookupOrderNumber, email: lookupEmail } },
      );
      setLookupResult(response.data);
    } catch (error) {
      console.error("Order lookup failed:", error);
      setLookupError("We couldn't find an order matching those details.");
    } finally {
      setLookupLoading(false);
    }
  };

  const addProduct = (product: ProductData) => {
    try {
      addToCart({
        product_id: product.id,
        name: product.title,
        slug: product.slug,
        price: product.price,
        image: product.image,
      });
      setCart(readCart());
    } catch (error) {
      console.error("Unable to add shop product to cart:", error);
      setLoadError("Unable to add this product to cart.");
    }
  };

  if (
    !embedded &&
    activeTemplate?.path === location.pathname &&
    activeTemplate.type === templateTypes[page] &&
    activeTemplate.template.layout?.length
  ) {
    return (
      <BuilderRenderer
        layout={activeTemplate.template.layout}
        pageId={activeTemplate.template.id}
        pageTitle={activeTemplate.template.title}
      />
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px 60px" }}>
      <nav aria-label="Store" style={{ display: "flex", gap: 18, marginBottom: 24 }}>
        <Link to="/shop">Shop</Link>
        <Link to="/cart">Cart ({cart.reduce((count, item) => count + item.quantity, 0)})</Link>
        <Link to="/my-account">My account</Link>
      </nav>
      {cartError && <p role="alert">{cartError}</p>}

      {page === "shop" && (
        <>
          <h1>Shop</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "20px 0" }}>
            <input aria-label="Search products" value={search} onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }} placeholder="Search products…" />
            <select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value); setPageNumber(1); }}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select aria-label="Sort products" value={sort} onChange={(event) => { setSort(event.target.value); setPageNumber(1); }}>
              <option value="name">Name</option><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option>
            </select>
          </div>
          {loadError && <p role="alert">{loadError}</p>}
          {!loadError && !visibleProducts.length && <p>No products found.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 18 }}>
            {visibleProducts.map((product) => (
              <article key={product.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                <Link to={product.permalink || `/products/${encodeURIComponent(product.slug || product.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {product.image && <img src={getImageUrl(product.image)} alt={product.title} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />}
                  <div style={{ padding: 12 }}><h2 style={{ fontSize: 17 }}>{product.title}</h2><strong>{money(product.price)}</strong></div>
                </Link>
                <div style={{ padding: "0 12px 12px" }}>
                  <button
                    type="button"
                    disabled={product.stock_status === "out_of_stock" || (product.manage_stock !== false && product.quantity <= 0)}
                    onClick={() => addProduct(product)}
                  >
                    {product.stock_status === "out_of_stock" || (product.manage_stock !== false && product.quantity <= 0) ? "Out of stock" : "Add to cart"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {totalPages > 1 && <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
            <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((current) => current - 1)}>Previous</button>
            <span>Page {pageNumber} of {totalPages}</span>
            <button type="button" disabled={pageNumber >= totalPages} onClick={() => setPageNumber((current) => current + 1)}>Next</button>
          </div>}
        </>
      )}

      {page === "cart" && (
        <>
          <h1>Your Cart</h1>
          {!cart.length ? <p>Your cart is empty. <Link to="/shop">Browse the shop</Link>.</p> : (
            <>
              <div style={{ display: "grid", gap: 12 }}>
                {cart.map((item) => (
                  <article key={item.product_id} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", borderBottom: "1px solid #e5e7eb", padding: "12px 0" }}>
                    {item.image ? <img src={getImageUrl(item.image)} alt="" style={{ width: 80, height: 80, objectFit: "cover" }} /> : <span />}
                    <Link to={`/products/${encodeURIComponent(item.slug || item.product_id)}`}>{item.name}</Link>
                    <span>{money(item.price)}</span>
                    <input aria-label={`Quantity for ${item.name}`} type="number" min={0} value={item.quantity} onChange={(event) => updateCartQuantity(item.product_id, Number(event.target.value))} />
                    <button type="button" onClick={() => updateCartQuantity(item.product_id, 0)}>Remove</button>
                  </article>
                ))}
              </div>
              <h2 style={{ textAlign: "right" }}>Subtotal: {money(cartTotal)}</h2>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}><button type="button" onClick={clearCart}>Empty cart</button><Link to="/checkout">Proceed to checkout</Link></div>
            </>
          )}
        </>
      )}

      {page === "checkout" && (
        <>
          <h1>Checkout</h1>
          {!cart.length ? <p>Your cart is empty. <Link to="/shop">Browse the shop</Link>.</p> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 32 }}>
              <form onSubmit={submitCheckout} style={{ display: "grid", gap: 14 }}>
                {checkoutError && <div role="alert">{checkoutError}</div>}
                <label>Name<input required maxLength={160} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
                <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                <label>Phone<input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                <label>Billing / shipping address<textarea required minLength={5} rows={4} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
                <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="cash_on_delivery">Cash on delivery</option><option value="bank_transfer">Offline bank transfer</option>{razorpayEnabled && <option value="razorpay">Pay online (Razorpay)</option>}</select></label>
                {paymentMethod === "bank_transfer" && <p>Payment instructions will need to be configured by the store administrator. Your order will remain pending until payment is confirmed.</p>}
                <button type="submit" disabled={submitting}>{submitting ? "Placing order…" : "Place order"}</button>
              </form>
              <aside><h2>Your order</h2>{cart.map((item) => <p key={item.product_id}>{item.name} × {item.quantity} <strong>{money(item.price * item.quantity)}</strong></p>)}<hr /><strong>Total: {money(cartTotal)}</strong><p>Prices and stock are validated again when the order is placed.</p></aside>
            </div>
          )}
        </>
      )}

      {page === "received" && (
        <>
          <h1>Order received</h1>
          <p>{receipt?.order_number ? `Thank you. Your order number is ${receipt.order_number}.` : "Thank you. Your order was submitted."}</p>
          {receipt && <p>Order total: {money(receipt.total)}</p>}
          <p>
            {receipt?.payment_status === "paid"
              ? "Your online payment has been confirmed."
              : "Payment is pending until the store confirms it."}
          </p>
          <Link to="/shop">Continue shopping</Link>
        </>
      )}

      {page === "account" && (
        <>
          <h1>My Account</h1>
          <p>Look up your order using the order number from your confirmation and the email used at checkout.</p>
          <form onSubmit={(event) => void lookupOrder(event)} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
            <label>Order number<input required value={lookupOrderNumber} onChange={(event) => setLookupOrderNumber(event.target.value)} /></label>
            <label>Email<input required type="email" value={lookupEmail} onChange={(event) => setLookupEmail(event.target.value)} /></label>
            {lookupError && <p role="alert">{lookupError}</p>}
            <button type="submit" disabled={lookupLoading}>{lookupLoading ? "Looking up…" : "View order"}</button>
          </form>
          {lookupResult && (
            <section aria-live="polite">
              <h2>Order {lookupResult.order_number}</h2>
              <p>Status: {lookupResult.status} · Payment: {lookupResult.payment_status}</p>
              {lookupResult.items.map((item, index) => (
                <p key={`${item.name}-${index}`}>{item.name} × {item.quantity} — {money(item.unit_price * item.quantity)}</p>
              ))}
              <strong>Total: {money(lookupResult.total)}</strong>
            </section>
          )}
        </>
      )}
    </main>
  );
};

export default Storefront;
