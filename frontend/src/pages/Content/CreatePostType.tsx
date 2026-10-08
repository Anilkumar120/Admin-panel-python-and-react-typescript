import { useState, type FormEvent } from "react";

import { useNavigate } from "react-router-dom";

import { createPostType } from "../../api/content";

const CreatePostType = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");

  const [slug, setSlug] = useState("");

  const [icon, setIcon] = useState("📄");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const handleNameChange = (value: string) => {
    setName(value);

    setSlug(
      value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("Post type name is required");

      return;
    }

    if (!slug.trim()) {
      setError("Post type slug is required");

      return;
    }

    setSaving(true);

    try {
      await createPostType(name.trim(), slug.trim(), icon);

      navigate("/admin/content/post-types");
    } catch (error: any) {
      console.log("CREATE POST TYPE ERROR:", error);

      setError(error.response?.data?.detail || "Failed to create post type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Add New Post Type</h1>

          <p>Create a custom content type</p>
        </div>
      </div>

      {error && <div className="content-message-error">{error}</div>}

      <div className="content-card">
        <form className="content-form" onSubmit={handleSubmit}>
          <div className="content-form-group">
            <label>Post Type Name</label>

            <input
              type="text"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="Example: Services"
              required
            />
          </div>

          <div className="content-form-group">
            <label>Slug</label>

            <input
              type="text"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="services"
              required
            />
          </div>

          <div className="content-form-group">
            <label>Icon</label>

            <input
              type="text"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              placeholder="📄"
            />
          </div>

          <div className="content-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Post Type"}
            </button>

            <button
              type="button"
              className="content-cancel-button"
              onClick={() => navigate("/admin/content/post-types")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePostType;
