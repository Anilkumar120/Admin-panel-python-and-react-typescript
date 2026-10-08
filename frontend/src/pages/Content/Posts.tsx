import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import {
  getContentByPostType,
  bulkMoveToTrash,
  moveContentToTrash,
  type ContentItem,
} from "../../api/content";

const Posts = () => {
  const [items, setItems] = useState<ContentItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadPosts = async () => {
    try {
      setLoading(true);

      setError("");

      const response = await getContentByPostType("posts");

      setItems(response.items);
    } catch (error) {
      console.log("POSTS ERROR:", error);

      setError("Unable to load posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const validIds = items
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));

      setSelectedIds(validIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((previous) => {
        if (previous.includes(id)) {
          return previous;
        }

        return [...previous, id];
      });
    } else {
      setSelectedIds((previous) => previous.filter((itemId) => itemId !== id));
    }
  };

  const handleTrash = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to move this post to Trash?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await moveContentToTrash(id);

      setSelectedIds((previous) => previous.filter((itemId) => itemId !== id));

      await loadPosts();
    } catch (error) {
      console.log("TRASH ERROR:", error);

      alert("Unable to move post to Trash.");
    }
  };

  const handleBulkTrash = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one post.");

      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to move ${selectedIds.length} selected post(s) to Trash?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await bulkMoveToTrash(selectedIds);

      setSelectedIds([]);

      await loadPosts();
    } catch (error) {
      console.log("BULK TRASH ERROR:", error);

      alert("Unable to move posts to Trash.");
    }
  };

  if (loading) {
    return (
      <div className="content-page">
        <div className="content-card">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-page">
        <div className="content-card">
          <div className="content-message-error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>📝 Posts</h1>

          <p>Manage all posts</p>
        </div>

        <div>
          <Link
            to="/admin/content/posts/create"
            className="content-primary-button"
          >
            + Add New
          </Link>
        </div>
      </div>

      <div className="content-dashboard-grid">
        <div className="content-stat-card">
          <div className="content-stat-icon">📝</div>

          <div>
            <div className="content-stat-title">Total Posts</div>

            <div className="content-stat-value">{items.length}</div>
          </div>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">📢</div>

          <div>
            <div className="content-stat-title">Published</div>

            <div className="content-stat-value">
              {items.filter((item) => item.status === "published").length}
            </div>
          </div>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">📝</div>

          <div>
            <div className="content-stat-title">Drafts</div>

            <div className="content-stat-value">
              {items.filter((item) => item.status === "draft").length}
            </div>
          </div>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">🗑️</div>

          <div>
            <div className="content-stat-title">Selected</div>

            <div className="content-stat-value">{selectedIds.length}</div>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h2>All Posts</h2>

            <p>Manage your posts</p>
          </div>
        </div>

        <div className="content-actions">
          <Link
            to="/admin/content/posts/categories"
            className="content-primary-button"
          >
            🗂️ Categories
          </Link>

          <Link
            to="/admin/content/posts/tags"
            className="content-primary-button"
          >
            🏷️ Tags
          </Link>

          <Link
            to="/admin/content/posts/trash"
            className="content-primary-button"
          >
            🗑️ Trash
          </Link>

          {selectedIds.length > 0 && (
            <button
              type="button"
              className="content-danger-button"
              onClick={handleBulkTrash}
            >
              🗑️ Move to Trash
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="content-empty-state">
            <h3>No posts found</h3>

            <p>Create your first post to get started.</p>

            <Link
              to="/admin/content/posts/create"
              className="content-primary-button"
            >
              + Add New
            </Link>
          </div>
        ) : (
          <div className="content-table-wrapper">
            <table className="content-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={
                        items.length > 0 && selectedIds.length === items.length
                      }
                      onChange={(event) =>
                        handleSelectAll(event.target.checked)
                      }
                    />
                  </th>

                  <th>Title</th>

                  <th>Slug</th>

                  <th>Status</th>

                  <th>SEO</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const itemId = item.id;

                  if (!itemId) {
                    return null;
                  }

                  return (
                    <tr key={itemId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(itemId)}
                          onChange={(event) =>
                            handleSelect(itemId, event.target.checked)
                          }
                        />
                      </td>

                      <td>{item.title}</td>

                      <td>{item.slug}</td>

                      <td>{item.status}</td>

                      <td>
                        {item.seo?.title || item.seo?.description
                          ? "Configured"
                          : "Not Set"}
                      </td>

                      <td>
                        <Link
                          to={`/admin/content/posts/${itemId}/edit`}
                          className="content-edit-button"
                        >
                          Edit
                        </Link>

                        <button
                          type="button"
                          className="content-delete-button"
                          onClick={() => handleTrash(itemId)}
                        >
                          Trash
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Posts;
