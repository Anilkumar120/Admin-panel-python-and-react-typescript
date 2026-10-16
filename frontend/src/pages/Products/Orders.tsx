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
        {loading ? <p style={{ padding: 20 }}>Loading orders…</p> : orders.length ? (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{order.order_number}</strong></td>
                    <td>{order.customer_name}<small style={{ display: "block" }}>{order.email}</small><small>{order.phone}</small><small style={{ display: "block" }}>{order.address}</small></td>
                    <td>{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</td>
                    <td>{order.items.map((item, index) => <div key={`${item.name}-${index}`}>{item.name} × {item.quantity}</div>)}</td>
                    <td>₹{Number(order.total).toFixed(2)}</td>
                    <td>{order.payment_method.replace("_", " ")}<small style={{ display: "block" }}>{order.payment_status}</small></td>
                    <td>{isTrash ? statusLabels[order.status] : (
                      <select aria-label={`Status for ${order.order_number}`} value={order.status} onChange={(event) => void changeStatus(order, event.target.value as OrderStatus)}>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    )}</td>
                    <td>
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
        ) : <p style={{ padding: 20 }}>{isTrash ? "Trash is empty." : "No orders yet. Orders submitted through checkout will appear here."}</p>}
      </div>
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
