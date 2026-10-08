import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  getUsers,
  getTrashUsers,
  changeUserRole,
  changeUserStatus,
  moveUserToTrash,
  restoreUser,
  deleteUser,
  type UsersResponse,
} from "../../api/users";

const Users = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UsersResponse["users"]>([]);

  const [search, setSearch] = useState("");

  const [view, setView] = useState<"users" | "trash">("users");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadUsers = async () => {
    setLoading(true);

    setError("");

    try {
      const response =
        view === "users" ? await getUsers() : await getTrashUsers();

      setUsers(response.users);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [view]);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()),
  );

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await changeUserRole(userId, role);

      await loadUsers();
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to update role");
    }
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    try {
      await changeUserStatus(userId, isActive);

      await loadUsers();
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to update status");
    }
  };

  const handleTrash = async (userId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to move this user to trash?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await moveUserToTrash(userId);

      await loadUsers();
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to move user to trash");
    }
  };

  const handleRestore = async (userId: string) => {
    try {
      await restoreUser(userId);

      await loadUsers();
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to restore user");
    }
  };

  const handlePermanentDelete = async (userId: string) => {
    const confirmed = window.confirm(
      "This will permanently delete the user. Continue?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteUser(userId);

      await loadUsers();
    } catch (error: any) {
      setError(
        error.response?.data?.detail || "Failed to permanently delete user",
      );
    }
  };

  return (
    <div className="users-page">
      <div className="page-heading">
        <div>
          <h1>Users</h1>

          <p>Manage users and user accounts.</p>
        </div>

        {view === "users" && (
          <button
            className="primary-button"
            onClick={() => navigate("/admin/users/create")}
          >
            Add User
          </button>
        )}
      </div>

      <div className="users-toolbar">
        <div>
          <button
            className={view === "users" ? "primary-button" : "secondary-button"}
            onClick={() => setView("users")}
          >
            All Users
          </button>

          <button
            className={view === "trash" ? "primary-button" : "secondary-button"}
            onClick={() => setView("trash")}
          >
            Trash
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users..."
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <div>Loading users...</div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>

                <th>Email</th>

                <th>Role</th>

                <th>Status</th>

                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5}>No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>

                    <td>{user.email}</td>

                    <td>
                      {view === "users" ? (
                        <select
                          value={user.role}
                          onChange={(event) =>
                            handleRoleChange(user.id, event.target.value)
                          }
                        >
                          <option value="subscriber">Subscriber</option>

                          <option value="contributor">Contributor</option>

                          <option value="author">Author</option>

                          <option value="editor">Editor</option>

                          <option value="seo_editor">SEO Editor</option>

                          <option value="seo_manager">SEO Manager</option>

                          <option value="web_designer">Web Designer</option>

                          <option value="administrator">Administrator</option>
                        </select>
                      ) : (
                        user.role
                      )}
                    </td>

                    <td>
                      {view === "users" ? (
                        <select
                          value={user.is_active ? "active" : "inactive"}
                          onChange={(event) =>
                            handleStatusChange(
                              user.id,
                              event.target.value === "active",
                            )
                          }
                        >
                          <option value="active">Active</option>

                          <option value="inactive">Inactive</option>
                        </select>
                      ) : (
                        "Trashed"
                      )}
                    </td>

                    <td>
                      {view === "users" ? (
                        <>
                          <button
                            className="secondary-button"
                            onClick={() =>
                              navigate(`/admin/users/${user.id}/edit`)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="secondary-button"
                            onClick={() => handleTrash(user.id)}
                          >
                            Trash
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="secondary-button"
                            onClick={() => handleRestore(user.id)}
                          >
                            Restore
                          </button>

                          <button
                            className="secondary-button"
                            onClick={() => handlePermanentDelete(user.id)}
                          >
                            Delete Permanently
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Users;
