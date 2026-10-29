import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../api/config";
import "./Orders.css";

type OrderStatus =
  | "pending"
  | "processing"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  created_at?: string;
}

type CustomerDetails = Pick<
  Order,
  "customer_name" | "email" | "phone" | "address"
>;

const statusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

const allowedStatuses = Object.keys(statusLabels) as OrderStatus[];

const safeText = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const safeNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const safeStatus = (value: unknown): OrderStatus => {
  const status = safeText(value).toLowerCase() as OrderStatus;
  return allowedStatuses.includes(status) ? status : "pending";
};

const formatCurrency = (value: unknown): string =>
  `₹${safeNumber(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value?: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

const normalizeOrder = (
  raw: Partial<Order> & { id: string }
): Order => ({
  id: safeText(raw.id),
  order_number: safeText(raw.order_number) || safeText(raw.id),
  customer_name: safeText(raw.customer_name) || "Guest customer",
  email: safeText(raw.email),
  phone: safeText(raw.phone),
  address: safeText(raw.address),
  items: Array.isArray(raw.items)
    ? raw.items.map((item) => ({
        name: safeText(item?.name) || "Product",
        quantity: Math.max(0, safeNumber(item?.quantity)),
        unit_price: safeNumber(item?.unit_price),
      }))
    : [],
  total: safeNumber(raw.total),
  status: safeStatus(raw.status),
  payment_method: safeText(raw.payment_method) || "Not specified",
  payment_status: safeText(raw.payment_status) || "Unknown",
  created_at: raw.created_at ? safeText(raw.created_at) : undefined,
});

const Orders = () => {
  const { view = "all" } = useParams<{ view: string }>();
  const isTrash = view === "trash";
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrderId, setEditingOrderId] = useState("");
  const [customerDraft, setCustomerDraft] = useState<CustomerDetails>({
    customer_name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
    }),
    []
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get<{
        orders?: Array<Partial<Order> & { id: string }>;
      }>(`${API_URL}/api/orders`, {
        headers: headers(),
        params: { trash: isTrash },
      });

      const result = Array.isArray(response.data?.orders)
        ? response.data.orders.map(normalizeOrder)
        : [];

      setOrders(result);

      setSelectedOrder((current) => {
        if (!current) return null;
        return result.find((order) => order.id === current.id) || null;
      });
    } catch (loadError) {
      console.error("Unable to load orders:", loadError);
      setError(
        "Unable to load orders. Check your permissions and connection."
      );
    } finally {
      setLoading(false);
    }
  }, [headers, isTrash]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    setSelectedOrder(null);
    setEditingOrderId("");
    setStatusFilter("all");
  }, [isTrash]);

  const changeStatus = async (
    order: Order,
    status: OrderStatus
  ) => {
    if (order.status === status || statusUpdatingId) return;

    setStatusUpdatingId(order.id);
    setError("");
    setNotice("");

    try {
      await axios.patch(
        `${API_URL}/api/orders/${encodeURIComponent(order.id)}/status`,
        null,
        {
          headers: headers(),
          params: { status },
        }
      );

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, status } : item
        )
      );

      setSelectedOrder((current) =>
        current?.id === order.id
          ? { ...current, status }
          : current
      );

      setNotice(`Order #${order.order_number} status updated.`);
    } catch (updateError) {
      console.error("Unable to update order status:", updateError);
      setError("Unable to update order status. Please try again.");
    } finally {
      setStatusUpdatingId("");
    }
  };

  const moveOrder = async (
    order: Order,
    restore: boolean
  ) => {
    if (busyOrderId) return;

    setBusyOrderId(order.id);
    setError("");
    setNotice("");

    try {
      if (restore) {
        await axios.post(
          `${API_URL}/api/orders/${encodeURIComponent(order.id)}/restore`,
          {},
          { headers: headers() }
        );
      } else {
        await axios.delete(
          `${API_URL}/api/orders/${encodeURIComponent(order.id)}`,
          { headers: headers() }
        );
      }

      setSelectedOrder((current) =>
        current?.id === order.id ? null : current
      );

      setNotice(
        restore
          ? `Order #${order.order_number} restored.`
          : `Order #${order.order_number} moved to Trash.`
      );

      await loadOrders();
    } catch (moveError) {
      console.error("Unable to update order:", moveError);
      setError(
        restore
          ? "Unable to restore this order."
          : "Unable to move this order to Trash."
      );
    } finally {
      setBusyOrderId("");
    }
  };

  const openEditCustomer = (order: Order) => {
    setCustomerDraft({
      customer_name:
        order.customer_name === "Guest customer"
          ? ""
          : order.customer_name,
      email: order.email,
      phone: order.phone,
      address: order.address,
    });

    setError("");
    setNotice("");
    setEditingOrderId(order.id);
  };

  const saveCustomer = async () => {
    if (!editingOrderId || savingCustomer) return;

    const customerName = customerDraft.customer_name.trim();
    const email = customerDraft.email.trim();

    if (!customerName) {
      setError("Please enter the customer's name.");
      return;
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError("Please enter a valid email address.");
      return;
    }

    setSavingCustomer(true);
    setError("");
    setNotice("");

    try {
      await axios.put(
        `${API_URL}/api/orders/${encodeURIComponent(editingOrderId)}/customer`,
        {
          customer_name: customerName,
          email,
          phone: customerDraft.phone.trim(),
          address: customerDraft.address.trim(),
        },
        { headers: headers() }
      );

      setEditingOrderId("");
      setNotice("Customer information updated.");

      await loadOrders();
    } catch (saveError) {
      console.error(
        "Unable to update order customer details:",
        saveError
      );
      setError(
        "Unable to update customer information. Please try again."
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch = [
        order.order_number,
        order.customer_name,
        order.email,
        order.phone,
        order.payment_method,
      ].some((value) =>
        safeText(value).toLowerCase().includes(term)
      );

      return (
        matchesSearch &&
        (statusFilter === "all" || order.status === statusFilter)
      );
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="products-page orders-page">
      <div className="page-heading orders-page-heading">
        <div>
          <h1>{isTrash ? "Trash Orders" : "Orders"}</h1>
          <p>
            Review customer orders, payment details, items, and current status.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            navigate(
              isTrash ? "/admin/orders" : "/admin/orders/trash"
            )
          }
        >
          {isTrash ? "All Orders" : "Trash Orders"}
        </button>
      </div>

      {error && (
        <div role="alert" className="orders-message orders-error">
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="orders-message orders-success">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}

      <div className="table-card orders-card">
        <div className="orders-toolbar">
          <label className="orders-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Search orders"
              placeholder="Search orders, customers, email or phone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            aria-label="Filter orders by status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as OrderStatus | "all"
              )
            }
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={() => void loadOrders()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="orders-empty-cell">
                    Loading orders…
                  </td>
                </tr>
              ) : visibleOrders.length > 0 ? (
                visibleOrders.map((order) => {
                  const itemCount = order.items.reduce(
                    (sum, item) =>
                      sum + Math.max(0, safeNumber(item.quantity)),
                    0
                  );

                  return (
                    <tr key={order.id}>
                      <td>
                        <button
                          type="button"
                          className="orders-link-button"
                          onClick={() => setSelectedOrder(order)}
                        >
                          #{order.order_number}
                        </button>
                      </td>

                      <td>
                        <strong>{order.customer_name}</strong>
                        <small className="orders-muted">
                          {order.email || "No email provided"}
                        </small>
                      </td>

                      <td>{formatDate(order.created_at)}</td>

                      <td>
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </td>

                      <td className="orders-total">
                        {formatCurrency(order.total)}
                      </td>

                      <td>
                        <span className="orders-payment-method">
                          {order.payment_method.replace(/_/g, " ")}
                        </span>
                        <small className="orders-muted">
                          {order.payment_status}
                        </small>
                      </td>

                      <td>
                        {isTrash ? (
                          <span
                            className={`orders-status-badge status-${order.status}`}
                          >
                            {statusLabels[order.status]}
                          </span>
                        ) : (
                          <select
                            className={`orders-status-select status-${order.status}`}
                            aria-label={`Status for order ${order.order_number}`}
                            value={order.status}
                            disabled={statusUpdatingId === order.id}
                            onChange={(event) =>
                              void changeStatus(
                                order,
                                event.target.value as OrderStatus
                              )
                            }
                          >
                            {Object.entries(statusLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>
                        )}
                      </td>

                      <td>
                        <div className="orders-row-actions">
                          <button
                            type="button"
                            className="orders-action-button"
                            onClick={() => setSelectedOrder(order)}
                          >
                            View
                          </button>

                          {!isTrash && (
                            <button
                              type="button"
                              className="orders-action-button"
                              onClick={() => openEditCustomer(order)}
                            >
                              Edit
                            </button>
                          )}

                          <button
                            type="button"
                            className="orders-action-button orders-action-danger"
                            disabled={busyOrderId === order.id}
                            onClick={() =>
                              void moveOrder(order, isTrash)
                            }
                          >
                            {busyOrderId === order.id
                              ? "Working…"
                              : isTrash
                                ? "Restore"
                                : "Trash"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="orders-empty-cell">
                    {orders.length
                      ? "No orders match your search or filters."
                      : isTrash
                        ? "Trash is empty."
                        : "No orders yet. Orders submitted through checkout will appear here."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="orders-table-footer">
          Showing {loading ? 0 : visibleOrders.length} of {orders.length} orders
        </div>
      </div>

      {selectedOrder && (
        <div
          className="orders-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedOrder(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
            className="orders-modal orders-details-modal"
          >
            <div className="orders-modal-header">
              <div>
                <h2 id="order-details-title">
                  Order #{selectedOrder.order_number}
                </h2>
                <p>Placed {formatDate(selectedOrder.created_at)}</p>
              </div>

              <button
                type="button"
                className="orders-modal-close"
                aria-label="Close order details"
                onClick={() => setSelectedOrder(null)}
              >
                ×
              </button>
            </div>

            <div className="orders-detail-grid">
              <section className="orders-detail-section">
                <h3>Customer details</h3>
                <p>
                  <strong>{selectedOrder.customer_name}</strong>
                </p>
                <p>{selectedOrder.email || "No email provided"}</p>
                <p>{selectedOrder.phone || "No phone provided"}</p>
                <p className="orders-address">
                  {selectedOrder.address || "No address provided"}
                </p>
              </section>

              <section className="orders-detail-section">
                <h3>Payment and status</h3>
                <p>
                  Payment method:{" "}
                  <strong>
                    {selectedOrder.payment_method.replace(/_/g, " ")}
                  </strong>
                </p>
                <p>
                  Payment status:{" "}
                  <strong>{selectedOrder.payment_status}</strong>
                </p>
                <p>
                  Order status:{" "}
                  <strong>{statusLabels[selectedOrder.status]}</strong>
                </p>
              </section>
            </div>

            <h3 className="orders-items-heading">Items ordered</h3>

            <div className="orders-items-table-wrap">
              <table className="orders-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item, index) => (
                      <tr key={`${item.name}-${index}`}>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.unit_price)}</td>
                        <td>
                          {formatCurrency(
                            safeNumber(item.unit_price) *
                              safeNumber(item.quantity)
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="orders-empty-cell">
                        No item details available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="orders-grand-total">
              <span>Order total</span>
              <strong>{formatCurrency(selectedOrder.total)}</strong>
            </div>

            <div className="orders-modal-footer">
              {!isTrash && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => openEditCustomer(selectedOrder)}
                >
                  Edit customer
                </button>
              )}

              <button
                type="button"
                className="primary-button"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingOrderId && (
        <div
          className="orders-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !savingCustomer
            ) {
              setEditingOrderId("");
            }
          }}
        >
          <form
            className="orders-modal orders-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-customer-title"
            onSubmit={(event) => {
              event.preventDefault();
              void saveCustomer();
            }}
          >
            <div className="orders-modal-header">
              <div>
                <h2 id="edit-customer-title">
                  Edit customer information
                </h2>
                <p>Update the contact details for this order.</p>
              </div>

              <button
                type="button"
                className="orders-modal-close"
                aria-label="Close edit customer dialog"
                disabled={savingCustomer}
                onClick={() => setEditingOrderId("")}
              >
                ×
              </button>
            </div>

            <div className="orders-form-grid">
              <label>
                Customer name *
                <input
                  autoFocus
                  required
                  value={customerDraft.customer_name}
                  onChange={(event) =>
                    setCustomerDraft({
                      ...customerDraft,
                      customer_name: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Email address
                <input
                  type="email"
                  value={customerDraft.email}
                  onChange={(event) =>
                    setCustomerDraft({
                      ...customerDraft,
                      email: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Phone
                <input
                  type="tel"
                  value={customerDraft.phone}
                  onChange={(event) =>
                    setCustomerDraft({
                      ...customerDraft,
                      phone: event.target.value,
                    })
                  }
                />
              </label>

              <label className="orders-full-width">
                Address
                <textarea
                  rows={4}
                  value={customerDraft.address}
                  onChange={(event) =>
                    setCustomerDraft({
                      ...customerDraft,
                      address: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <p className="orders-edit-note">
              This form updates customer details only. Order items,
              quantities, and totals are unchanged.
            </p>

            <div className="orders-modal-footer">
              <button
                type="button"
                className="secondary-button"
                disabled={savingCustomer}
                onClick={() => setEditingOrderId("")}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={savingCustomer}
              >
                {savingCustomer ? "Saving…" : "Save customer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Orders;