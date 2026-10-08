import { useEffect, useState } from "react";

import { Link, useParams } from "react-router-dom";

import {
  getContentByPostType,
  moveContentToTrash,
  bulkMoveToTrash,
  type ContentItem,
  type PostType,
} from "../../api/content";

const CustomPostTypeContent = () => {
  const { postTypeSlug } = useParams<{
    postTypeSlug: string;
  }>();

  const [postType, setPostType] = useState<PostType | null>(null);

  const [items, setItems] = useState<ContentItem[]>([]);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadContent = async () => {
    if (!postTypeSlug) {
      return;
    }

    try {
      setLoading(true);

      setError("");

      const response = await getContentByPostType(postTypeSlug);

      setPostType(response.post_type);

      setItems(response.items);

      setSelectedItems([]);
    } catch (error) {
      console.log("CONTENT TYPE ERROR:", error);

      setError("Unable to load content.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, [postTypeSlug]);

  const allSelected =
    items.length > 0 &&
    items.every((item) => item.id && selectedItems.includes(item.id));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedItems([]);

      return;
    }

    setSelectedItems(
      items.map((item) => item.id).filter((id): id is string => Boolean(id)),
    );
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems((previous) => {
      if (previous.includes(id)) {
        return previous.filter((item) => item !== id);
      }

      return [...previous, id];
    });
  };

  const handleMoveToTrash = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to move this item to Trash?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await moveContentToTrash(id);

      setSelectedItems((previous) => previous.filter((item) => item !== id));

      await loadContent();
    } catch (error) {
      console.log("MOVE TO TRASH ERROR:", error);

      setError("Unable to move item to Trash.");
    }
  };

  const handleBulkMoveToTrash = async () => {
    if (selectedItems.length === 0) {
      setError("Please select at least one item.");

      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to move ${selectedItems.length} selected item(s) to Trash?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await bulkMoveToTrash(selectedItems);

      setSelectedItems([]);

      await loadContent();
    } catch (error) {
      console.log("BULK TRASH ERROR:", error);

      setError("Unable to move selected items to Trash.");
    }
  };

  if (loading) {
    return (
      <div className="content-page">
        <div className="content-card">Loading...</div>
      </div>
    );
  }

  if (error && !postType) {
    return (
      <div className="content-page">
        <div className="content-card">
          <div className="content-message-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!postType) {
    return (
      <div className="content-page">
        <div className="content-card">Post Type not found.</div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>
            <span>{postType.icon || "📄"}</span> {postType.name}
          </h1>

          <p>Manage {postType.name.toLowerCase()} content</p>
        </div>

        <div className="content-actions">
          <Link
            to={`/admin/content/${postType.slug}/trash`}
            className="content-secondary-button"
          >
            🗑️ Trash
          </Link>

          <Link
            to={`/admin/content/${postType.slug}/create`}
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
            <div className="content-stat-title">Total</div>

            <div className="content-stat-value">{items.length}</div>
          </div>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">🗂️</div>

          <div>
            <div className="content-stat-title">Categories</div>

            <div className="content-stat-value">
              {postType.taxonomies?.some(
                (taxonomy) => taxonomy.type === "category",
              )
                ? "Enabled"
                : "Disabled"}
            </div>
          </div>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">🏷️</div>

          <div>
            <div className="content-stat-title">Tags</div>

            <div className="content-stat-value">
              {postType.taxonomies?.some((taxonomy) => taxonomy.type === "tag")
                ? "Enabled"
                : "Disabled"}
            </div>
          </div>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">🔎</div>

          <div>
            <div className="content-stat-title">SEO</div>

            <div className="content-stat-value">
              {postType.features?.seo ? "Enabled" : "Disabled"}
            </div>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h2>{postType.name}</h2>

            <p>Manage all {postType.name.toLowerCase()} content</p>
          </div>
        </div>

        {error && <div className="content-message-error">{error}</div>}

        <div className="content-actions">
          {postType.taxonomies?.some(
            (taxonomy) => taxonomy.type === "category",
          ) && (
            <Link
              to={`/admin/content/${postType.slug}/categories`}
              className="content-primary-button"
            >
              🗂️ Categories
            </Link>
          )}

          {postType.taxonomies?.some((taxonomy) => taxonomy.type === "tag") && (
            <Link
              to={`/admin/content/${postType.slug}/tags`}
              className="content-primary-button"
            >
              🏷️ Tags
            </Link>
          )}

          {postType.features?.seo && (
            <button type="button" className="content-primary-button">
              🔎 SEO Settings
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="content-empty-state">
            <h3>No {postType.name.toLowerCase()} found</h3>

            <p>
              Create your first {postType.name.toLowerCase()} to get started.
            </p>

            <Link
              to={`/admin/content/${postType.slug}/create`}
              className="content-primary-button"
            >
              + Add New
            </Link>
          </div>
        ) : (
          <div className="content-table-wrapper">
            {selectedItems.length > 0 && (
              <div className="content-actions">
                <span>{selectedItems.length} selected</span>

                <button
                  type="button"
                  className="content-secondary-button"
                  onClick={handleBulkMoveToTrash}
                >
                  🗑️ Move to Trash
                </button>
              </div>
            )}

            <table className="content-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
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
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={
                          item.id ? selectedItems.includes(item.id) : false
                        }
                        onChange={() => {
                          if (item.id) {
                            handleSelectItem(item.id);
                          }
                        }}
                      />
                    </td>

                    <td>{item.title}</td>

                    <td>{item.slug}</td>

                    <td>{item.status}</td>

                    <td>{postType.features?.seo ? "Enabled" : "Not Set"}</td>

                    <td>
                      <div className="content-actions">
                        <Link
                          to={`/admin/content/${postType.slug}/${item.id}/edit`}
                          className="content-edit-button"
                        >
                          Edit
                        </Link>

                        <button
                          type="button"
                          className="content-secondary-button"
                          onClick={() => {
                            if (item.id) {
                              handleMoveToTrash(item.id);
                            }
                          }}
                        >
                          🗑️ Trash
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomPostTypeContent;
