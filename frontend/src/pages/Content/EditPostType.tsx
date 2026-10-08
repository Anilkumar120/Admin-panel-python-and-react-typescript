import { useEffect, useState, type FormEvent } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { getPostType, updatePostType } from "../../api/content";

const EditPostType = () => {
  const navigate = useNavigate();

  const { postTypeId } = useParams();

  const [name, setName] = useState("");

  const [slug, setSlug] = useState("");

  const [icon, setIcon] = useState("📄");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const loadPostType = async () => {
    if (!postTypeId) {
      return;
    }

    try {
      const postType = await getPostType(postTypeId);

      if (postType.is_builtin) {
        setError("Built-in post types cannot be edited");

        return;
      }

      setName(postType.name);

      setSlug(postType.slug);

      setIcon(postType.icon);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to load post type");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!postTypeId) {
      return;
    }

    setSaving(true);

    try {
      await updatePostType(postTypeId, name.trim(), slug.trim(), icon);

      navigate("/admin/content/post-types");
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to update post type");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadPostType();
  }, [postTypeId]);

  if (loading) {
    return (
      <div className="content-page">
        <div className="content-loading">Loading post type...</div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Edit Post Type</h1>

          <p>Update custom content type</p>
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
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="content-form-group">
            <label>Slug</label>

            <input
              type="text"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              required
            />
          </div>

          <div className="content-form-group">
            <label>Icon</label>

            <input
              type="text"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
            />
          </div>

          <div className="content-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
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

export default EditPostType;
