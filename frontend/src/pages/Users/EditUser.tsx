import { useEffect, useState, type FormEvent } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { getUser, updateUser } from "../../api/users";

const EditUser = () => {
  const navigate = useNavigate();

  const { userId } = useParams();

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [role, setRole] = useState("subscriber");

  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      if (!userId) {
        setError("Invalid user ID");

        setLoading(false);

        return;
      }

      try {
        const user = await getUser(userId);

        if (!user) {
          setError("User not found");

          setLoading(false);

          return;
        }

        setName(user.name);

        setEmail(user.email);

        setRole(user.role);

        setIsActive(user.is_active);
      } catch (error: any) {
        setError(error.response?.data?.detail || "Failed to load user");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) {
      return;
    }

    setError("");

    setSaving(true);

    try {
      await updateUser(userId, name, email, password, role, isActive);

      navigate("/admin/users");
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading user...</div>;
  }

  return (
    <div className="create-user-page">
      <div className="page-heading">
        <div>
          <h1>Edit User</h1>

          <p>Update user account details.</p>
        </div>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name</label>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>New Password</label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Leave blank to keep current password"
              />
            </div>

            <div className="form-group">
              <label>Role</label>

              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
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
            </div>

            <div className="form-group">
              <label>Status</label>

              <select
                value={isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setIsActive(event.target.value === "active")
                }
              >
                <option value="active">Active</option>

                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/admin/users")}
            >
              Cancel
            </button>

            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Updating..." : "Update User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUser;
