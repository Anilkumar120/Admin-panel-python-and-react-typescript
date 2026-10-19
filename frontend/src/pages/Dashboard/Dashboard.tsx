import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getImageUrl } from "../../api/profile";
import { getDashboardStats, type DashboardStats } from "../../api/dashboard";
import Terminal, { ColorMode, TerminalOutput } from "react-terminal-ui";
import axios from "axios";
import { API_URL } from "../../api/config";
import { Terminal as TerminalIcon, X } from "lucide-react"; // 👈 Icons for Button & Close

/* ============================================================
   INLINE COMMAND PROMPT
   ============================================================ */
function InlineCommandPrompt({
  onRunCommand,
  title = "inventory > terminal",
}: {
  onRunCommand?: (cmd: string) => Promise<string> | string;
  title?: string;
}) {
  const [lines, setLines] = useState<React.ReactNode[]>([
    <TerminalOutput key="welcome">
      Type <b>help</b> to see available commands.
    </TerminalOutput>,
  ]);

  const handleInput = async (input: string) => {
    const cmd = input.trim();
    if (!cmd) return;

    setLines((prev) => [
      ...prev,
      <TerminalOutput key={`in-${Date.now()}`}>$ {cmd}</TerminalOutput>,
    ]);

    if (cmd === "clear") {
      setLines([]);
      return;
    }

    let output = "";

    if (cmd === "help") {
      output =
        "Available commands:\n" +
        "  stats                          - Dashboard stats\n" +
        "  dirs                           - List directories\n" +
        "  files <dir_path>               - List files in a directory\n" +
        "  db collections                 - List DB collections\n" +
        "  db <collection_name>           - Show DB collection data\n" +
        "  logs                           - Show system logs\n" +
        "  products list [limit]          - List products\n" +
        "  orders pending                 - Pending orders\n" +
        "  users count                    - Total users\n" +
        "  clear                          - Clear terminal";
    } else if (onRunCommand) {
      try {
        output = await onRunCommand(cmd);
      } catch (err: any) {
        output = `❌ Error: ${err.message || "Failed to run command"}`;
      }
    } else {
      output = `❌ Unknown command: ${cmd}`;
    }

    setLines((prev) => [
      ...prev,
      <TerminalOutput key={`out-${Date.now()}`}>{output}</TerminalOutput>,
    ]);
  };

  return (
    <div className="terminal-card" style={{ margin: 0, boxShadow: "none" }}>
      <div className="terminal-card-header">
        <h2>{title}</h2>
      </div>
      <div className="terminal-card-body">
        <Terminal
          name=""
          prompt="›"
          height="400px"
          colorMode={ColorMode.Dark}
          onInput={handleInput}
        >
          {lines}
        </Terminal>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // 👈 State for Terminal Modal
  const [showTerminal, setShowTerminal] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getDashboardStats();
      setStats(response);
    } catch (error: any) {
      console.log("DASHBOARD ERROR:", error);
      setError(error.response?.data?.detail || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  /* 👇 Backend command runner */
  const runBackendCommand = async (cmd: string): Promise<string> => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.post(
        `${API_URL}/api/terminal/run`,
        { command: cmd },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return res.data.output ?? "";
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message;
      throw new Error(`HTTP ${err.response?.status || 500}: ${detail}`);
    }
  };

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
      {/* 👇 Top Heading with Diagnostic Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", color: "#0c2f55" }}>Dashboard</h1>
          <p style={{ margin: "5px 0 0", color: "#6b7280" }}>Overview of your inventory system</p>
        </div>
        <button
          onClick={() => setShowTerminal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            background: "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px"
          }}
        >
          <TerminalIcon size={18} /> Open Diagnostics
        </button>
      </div>

      <div
        className="dashboard-welcome"
        onClick={() => navigate("/admin/profile")}
        style={{ cursor: "pointer" }}
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
        <div className="dashboard-stat-card" onClick={() => navigate("/admin/users")} style={{ cursor: "pointer" }}>
          <div>
            <span>Total Users</span>
            <h2>{stats?.total_users ?? 0}</h2>
          </div>
          <div className="dashboard-stat-icon">👥</div>
        </div>

        <div className="dashboard-stat-card" onClick={() => navigate("/admin/users")} style={{ cursor: "pointer" }}>
          <div>
            <span>Active Users</span>
            <h2>{stats?.active_users ?? 0}</h2>
          </div>
          <div className="dashboard-stat-icon">🟢</div>
        </div>

        <div className="dashboard-stat-card" onClick={() => navigate("/admin/products")} style={{ cursor: "pointer" }}>
          <div>
            <span>Total Products</span>
            <h2>{stats?.total_products ?? 0}</h2>
          </div>
          <div className="dashboard-stat-icon">📦</div>
        </div>

        <div className="dashboard-stat-card" onClick={() => navigate("/admin/products/trash")} style={{ cursor: "pointer" }}>
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

      {/* 👇 TERMINAL MODAL OVERLAY */}
      {showTerminal && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            backdropFilter: "blur(2px)"
          }}
        >
          <div style={{ width: "100%", maxWidth: "900px", position: "relative" }}>
            {/* Close Button */}
            <button
              onClick={() => setShowTerminal(false)}
              style={{
                position: "absolute",
                top: "-40px",
                right: "0",
                background: "transparent",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "15px",
                fontWeight: "bold"
              }}
            >
              <X size={20} /> Close Terminal
            </button>
            
            {/* The Terminal */}
            <InlineCommandPrompt 
              onRunCommand={runBackendCommand} 
              title="System Diagnostics Terminal" 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;