import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  getContentByPostType,
  permanentlyDeleteContent,
  restoreContent,
  bulkPermanentDelete,
  bulkRestoreContent,
  type ContentItem,
  type PostType,
} from "../../api/content";

import { getPostTypeBySlug } from "../../api/content";

const ContentTrash = () => {
  const navigate = useNavigate();

  const { postTypeSlug } = useParams();

  const [postType, setPostType] = useState<PostType | null>(null);

  const [items, setItems] = useState<ContentItem[]>([]);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState("");

  const loadTrash = async () => {
    if (!postTypeSlug) {
      return;
    }

    try {
      setLoading(true);

      setError("");

      const postTypeResponse = await getPostTypeBySlug(postTypeSlug);

      const contentResponse = await getContentByPostType(postTypeSlug, true);

      setPostType(postTypeResponse);

      setItems(
        contentResponse.items.filter(
          (item: ContentItem) => item.is_deleted === true,
        ),
      );

      setSelectedItems([]);
    } catch (err) {
      console.error(err);

      setError("Failed to load trash.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, [postTypeSlug]);

  const handleSelectItem = (itemId: string) => {
    setSelectedItems((current) => {
      if (current.includes(itemId)) {
        return current.filter((id) => id !== itemId);
      }

      return [...current, itemId];
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);

      return;
    }

    setSelectedItems(
      items.map((item) => item.id).filter((id): id is string => Boolean(id)),
    );
  };

  const handleRestore = async (itemId: string) => {
    try {
      setProcessing(true);

      setError("");

      await restoreContent(itemId);

      await loadTrash();
    } catch (err) {
      console.error(err);

      setError("Failed to restore content.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = async (itemId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this content?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessing(true);

      setError("");

      await permanentlyDeleteContent(itemId);

      await loadTrash();
    } catch (err) {
      console.error(err);

      setError("Failed to permanently delete content.");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedItems.length === 0) {
      return;
    }

    try {
      setProcessing(true);

      setError("");

      await bulkRestoreContent(selectedItems);

      await loadTrash();
    } catch (err) {
      console.error(err);

      setError("Failed to restore selected content.");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedItems.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete the selected content?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessing(true);

      setError("");

      await bulkPermanentDelete(selectedItems);

      await loadTrash();
    } catch (err) {
      console.error(err);

      setError("Failed to permanently delete selected content.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="content-page">
        <div className="content-card">
          <p>Loading trash...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="content-card-header">
        <div>
          <h1>{postType?.name || "Content"} Trash</h1>

          <p>Manage deleted content.</p>
        </div>

        <button
          type="button"
          className="content-secondary-button"
          onClick={() => {
            navigate(`/admin/content/${postTypeSlug}`);
          }}
        >
          Back to Content
        </button>
      </div>

      {error && <div className="content-message-error">{error}</div>}

      {items.length > 0 && (
        <div className="content-card">
          <div className="content-actions">
            <button
              type="button"
              className="content-primary-button"
              onClick={handleBulkRestore}
              disabled={processing || selectedItems.length === 0}
            >
              Restore Selected
            </button>

            <button
              type="button"
              className="content-secondary-button"
              onClick={handleBulkPermanentDelete}
              disabled={processing || selectedItems.length === 0}
            >
              Delete Permanently
            </button>
          </div>
        </div>
      )}

      <div className="content-card">
        {items.length === 0 ? (
          <p>Trash is empty.</p>
        ) : (
          <div className="content-table-wrapper">
            <table className="content-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={
                        items.length > 0 &&
                        selectedItems.length === items.length
                      }
                      onChange={handleSelectAll}
                    />
                  </th>

                  <th>Title</th>

                  <th>Status</th>

                  <th>Deleted</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  if (!item.id) {
                    return null;
                  }

                  return (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => {
                            handleSelectItem(item.id!);
                          }}
                        />
                      </td>

                      <td>
                        <strong>{item.title}</strong>
                      </td>

                      <td>{item.status}</td>

                      <td>
                        {item.deleted_at
                          ? new Date(item.deleted_at).toLocaleString()
                          : "-"}
                      </td>

                      <td>
                        <div className="content-actions">
                          <button
                            type="button"
                            className="content-primary-button"
                            onClick={() => {
                              handleRestore(item.id!);
                            }}
                            disabled={processing}
                          >
                            Restore
                          </button>

                          <button
                            type="button"
                            className="content-secondary-button"
                            onClick={() => {
                              handlePermanentDelete(item.id!);
                            }}
                            disabled={processing}
                          >
                            Delete Permanently
                          </button>
                        </div>
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

export default ContentTrash;
