import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getMenus, deleteMenu } from "../../../api/menus";

interface Menu {
  id: string;
  name: string;
  items: any[];
}

const Menus = () => {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadMenus = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getMenus();
      setMenus(response);
    } catch (error: any) {
      console.log("GET MENUS ERROR:", error);
      setError(error?.response?.data?.detail || "Unable to load menus.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  const handleDelete = async (menu: Menu) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${menu.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteMenu(menu.id);
      setMenus(menus.filter((item) => item.id !== menu.id));
    } catch (error: any) {
      console.log("DELETE MENU ERROR:", error);

      alert(error?.response?.data?.detail || "Unable to delete menu.");
    }
  };

  return (
    <div className="content-page">
      <div className="content-page-header">
        <div>
          <h1>Menus</h1>
          <p>Create and manage your navigation menus.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/admin/appearance/menus/create")}
        >
          Add New Menu
        </button>
      </div>
      {error && <div className="error-message"> {error}</div>}

      {loading ? (
        <div> Loading menus...</div>
      ) : menus.length === 0 ? (
        <div className="empty-state">
          <h3> No menus found</h3>
          <p>Create your first navigation menu.</p>
          <button
            type="button"
            onClick={() => navigate("/admin/appearance/menus/create")}
          >
            Create Menu
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Menu Name</th>
                <th> Items</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {menus.map((menu) => (
                <tr key={menu.id}>
                  <td>
                    <strong> {menu.name} </strong>
                  </td>
                  <td>{Array.isArray(menu.items) ? menu.items.length : 0}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/admin/appearance/menus/${menu.id}/edit`)
                      }
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(menu)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Menus;
