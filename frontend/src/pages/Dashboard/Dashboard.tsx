import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import { getImageUrl } from "../../api/profile";

import { getDashboardStats, type DashboardStats } from "../../api/dashboard";

const Dashboard = () => {
  const { user } = useAuth();

  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);

    setError("");

    try {
      const response = await getDashboardStats();

      setStats(response);
    } catch (error: any) {
      console.log("DASHBOARD ERROR:", error);

      console.log("DASHBOARD RESPONSE:", error.response?.data);

      setError(error.response?.data?.detail || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-heading">
          <div>
            <h1>Dashboard</h1>

            <p>Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div
        className="dashboard-welcome"
        onClick={() => navigate("/admin/profile")}
        style={{
          cursor: "pointer",
        }}
      >
        <div className="dashboard-welcome-left">
          <div className="dashboard-profile-image-wrapper">
            {user?.profile_image ? (
              <img
                src={getImageUrl(user.profile_image)}
                alt="Profile"
                className="dashboard-profile-image"
              />
            ) : (
              <div className="dashboard-profile-placeholder">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
          </div>

          <div>
            <h1>Welcome, {user?.name || "User"}</h1>

            <p>{user?.role || "subscriber"}</p>
          </div>
        </div>

        <div className="dashboard-welcome-right">
          <strong>Profile</strong>

          <span>{user?.email || ""}</span>
        </div>
      </div>

      {error && <div className="profile-message-error">{error}</div>}

      <div className="dashboard-stats">
        <div
          className="dashboard-stat-card"
          onClick={() => navigate("/admin/users")}
          style={{
            cursor: "pointer",
          }}
        >
          <div>
            <span>Total Users</span>

            <h2>{stats?.total_users ?? 0}</h2>
          </div>

          <div className="dashboard-stat-icon">👥</div>
        </div>

        <div
          className="dashboard-stat-card"
          onClick={() => navigate("/admin/users")}
          style={{
            cursor: "pointer",
          }}
        >
          <div>
            <span>Active Users</span>

            <h2>{stats?.active_users ?? 0}</h2>
          </div>

          <div className="dashboard-stat-icon">🟢</div>
        </div>

        <div
          className="dashboard-stat-card"
          onClick={() => navigate("/admin/products")}
          style={{
            cursor: "pointer",
          }}
        >
          <div>
            <span>Total Products</span>

            <h2>{stats?.total_products ?? 0}</h2>
          </div>

          <div className="dashboard-stat-icon">📦</div>
        </div>

        <div
          className="dashboard-stat-card"
          onClick={() => navigate("/admin/products/trash")}
          style={{
            cursor: "pointer",
          }}
        >
          <div>
            <span>Trash Products</span>

            <h2>{stats?.trash_products ?? 0}</h2>
          </div>

          <div className="dashboard-stat-icon">🗑️</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2>Recent Users</h2>

          <div className="dashboard-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>

                  <th>Email</th>

                  <th>Role</th>

                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {stats?.recent_users?.length ? (
                  stats.recent_users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>

                      <td>{item.email}</td>

                      <td>{item.role}</td>

                      <td>{item.is_active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-card">
          <h2>Recent Products</h2>

          <div className="dashboard-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>

                  <th>Category</th>

                  <th>Price</th>

                  <th>Quantity</th>
                </tr>
              </thead>

              <tbody>
                {stats?.recent_products?.length ? (
                  stats.recent_products.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>

                      <td>{item.category}</td>

                      <td>₹{item.price}</td>

                      <td>{item.quantity}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No products found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
