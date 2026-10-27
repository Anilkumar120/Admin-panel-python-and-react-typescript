import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../api/config";

type OrderStatus = "pending" | "processing" | "on_hold" | "completed" | "cancelled" | "refunded" | "failed";
interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  items: { name: string; quantity: number; unit_price: number }[];
  total: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  created_at?: string;
}

type CustomerDetails = Pick<Order, "customer_name" | "email" | "phone" | "address">;

const statusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

const Orders = () => {
  const { view = "all" } = useParams();
  const isTrash = view === "trash";
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get<{ orders: Order[] }>(`${API_URL}/api/orders`, {
        headers: headers(),
        params: { trash: isTrash },
      });
      setOrders(response.data.orders);
    } catch (loadError) {
      console.error("Unable to load orders:", loadError);
      setError("Unable to load orders. Check your permissions and connection.");
    } finally {
      setLoading(false);
    }
  }, [isTrash]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const changeStatus = async (order: Order, status: OrderStatus) => {
    try {
      await axios.patch(
        `${API_URL}/api/orders/${order.id}/status`,
        null,
        { headers: headers(), params: { status } },
      );
      await loadOrders();
    } catch (updateError) {
      console.error("Unable to update order status:", updateError);
      setError("Unable to update order status.");
    }
  };

  const moveOrder = async (order: Order, restore: boolean) => {
    try {
      if (restore) {
        await axios.post(`${API_URL}/api/orders/${order.id}/restore`, {}, { headers: headers() });
      } else {
        await axios.delete(`${API_URL}/api/orders/${order.id}`, { headers: headers() });
      }
      await loadOrders();
    } catch (moveError) {
      console.error("Unable to update order:", moveError);
      setError("Unable to update this order.");
    }
  };

  const saveCustomer = async () => {
    if (!editingOrderId) return;
    try {
      await axios.put(
        `${API_URL}/api/orders/${editingOrderId}/customer`,
        customerDraft,
        { headers: headers() },
      );
      setEditingOrderId("");
      await loadOrders();
    } catch (saveError) {
      console.error("Unable to update order customer details:", saveError);
      setError("Unable to update customer information.");
    }
  };

  const visibleOrders = orders.filter((order) => {
    const matchesSearch = [
      order.order_number,
      order.customer_name,
      order.email,
      order.payment_method,
    ].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()));
    return matchesSearch && (statusFilter === "all" || order.status === statusFilter);
  });

  return (
    <div className="products-page">
      <div className="page-heading">
        <div>
          <h1>{isTrash ? "Trash Orders" : "Orders"}</h1>
          <p>Review customer orders, payment method, items, and current status.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => navigate(isTrash ? "/admin/orders" : "/admin/orders/trash")}>
          {isTrash ? "All Orders" : "Trash Orders"}
        </button>
      </div>
      {error && <div role="alert" className="table-error">{error}</div>}
      <div className="table-card">
        <div style={{ display: "flex", gap: 12, padding: 16, flexWrap: "wrap" }}>
          <input
            type="search"
            aria-label="Search orders"
            placeholder="Search orders, customers, or payment"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ flex: "1 1 260px", minWidth: 200 }}
          />
          <select
            aria-label="Filter orders by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")}
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {loading ? <p style={{ padding: 20 }}>Loading orders…</p> : visibleOrders.length ? (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <strong>#{order.order_number}</strong>
                      </button>
                    </td>
                    <td>{order.customer_name}<small style={{ display: "block" }}>{order.email}</small></td>
                    <td>{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</td>
                    <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)</td>
                    <td>₹{Number(order.total).toFixed(2)}</td>
                    <td>{order.payment_method.replaceAll("_", " ")}<small style={{ display: "block" }}>{order.payment_status}</small></td>
                    <td>{isTrash ? statusLabels[order.status] : (
                      <select aria-label={`Status for ${order.order_number}`} value={order.status} onChange={(event) => void changeStatus(order, event.target.value as OrderStatus)}>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    )}</td>
                    <td>
                      <button type="button" className="secondary-button" onClick={() => setSelectedOrder(order)}>View</button>
                      {!isTrash && <button type="button" className="secondary-button" onClick={() => {
                        setCustomerDraft({
                          customer_name: order.customer_name,
                          email: order.email,
                          phone: order.phone,
                          address: order.address,
                        });
                        setEditingOrderId(order.id);
                      }}>Edit customer</button>}
                      <button type="button" className="secondary-button" onClick={() => void moveOrder(order, isTrash)}>{isTrash ? "Restore" : "Move to trash"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ padding: 20 }}>{orders.length ? "No orders match the current filters." : isTrash ? "Trash is empty." : "No orders yet. Orders submitted through checkout will appear here."}</p>}
      </div>
      {selectedOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Order ${selectedOrder.order_number}`}
            className="order-customer-dialog"
            style={{ width: "min(760px, calc(100vw - 32px))", maxHeight: "85vh", overflowY: "auto", background: "#fff", borderRadius: 10, padding: 24 }}
          >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <h2 style={{ marginTop: 0 }}>Order #{selectedOrder.order_number}</h2>
              <p>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : "Date unavailable"}</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setSelectedOrder(null)}>Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            <section>
              <h3>Customer</h3>
              <p>{selectedOrder.customer_name}<br />{selectedOrder.email}<br />{selectedOrder.phone}</p>
              <p>{selectedOrder.address}</p>
            </section>
            <section>
              <h3>Payment</h3>
              <p>{selectedOrder.payment_method.replaceAll("_", " ")}</p>
              <p>Status: {selectedOrder.payment_status}</p>
              <p>Order status: {statusLabels[selectedOrder.status]}</p>
            </section>
          </div>
          <h3>Items</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead>
              <tbody>
                {selectedOrder.items.map((item, index) => (
                  <tr key={`${item.name}-${index}`}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{Number(item.unit_price).toFixed(2)}</td>
                    <td>₹{(Number(item.unit_price) * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: "right", fontWeight: 700, padding: "16px 0" }}>
            Total: ₹{Number(selectedOrder.total).toFixed(2)}
          </div>
          </div>
        </div>
      )}
      {editingOrderId && (
        <div role="dialog" aria-modal="true" aria-label="Edit order customer" className="order-customer-dialog">
          <h2>Edit customer information</h2>
          <label>Name<input value={customerDraft.customer_name} onChange={(event) => setCustomerDraft({ ...customerDraft, customer_name: event.target.value })} /></label>
          <label>Email<input type="email" value={customerDraft.email} onChange={(event) => setCustomerDraft({ ...customerDraft, email: event.target.value })} /></label>
          <label>Phone<input value={customerDraft.phone} onChange={(event) => setCustomerDraft({ ...customerDraft, phone: event.target.value })} /></label>
          <label>Address<textarea rows={4} value={customerDraft.address} onChange={(event) => setCustomerDraft({ ...customerDraft, address: event.target.value })} /></label>
          <button type="button" className="secondary-button" onClick={() => setEditingOrderId("")}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => void saveCustomer()}>Save customer</button>
        </div>
      )}
    </div>
  );
};

export default Orders;
