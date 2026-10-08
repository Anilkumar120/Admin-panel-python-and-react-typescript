import { useState, type FormEvent } from "react";

import { useNavigate } from "react-router-dom";

import { createUser } from "../../api/users";

const CreateUser = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [role, setRole] = useState("subscriber");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    setLoading(true);

    try {
      await createUser(name, email, password, role);

      navigate("/admin/users");
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-user-page">
      <div className="page-heading">
        <div>
          <h1>Add User</h1>

          <p>Create a new user account.</p>
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
                placeholder="Enter name"
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter email"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                required
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

            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUser;
