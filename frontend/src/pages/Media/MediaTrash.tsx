import { useEffect, useState } from "react";

import {
  getMediaTrash,
  restoreMedia,
  bulkRestoreMedia,
  permanentDeleteMedia,
  bulkPermanentDeleteMedia,
  emptyMediaTrash,
  type MediaItem,
} from "../../api/media";

const MediaTrash = () => {
  const API_URL = import.meta.env.VITE_API_URL;

  const [media, setMedia] = useState<MediaItem[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");

  const [fileType, setFileType] = useState("");

  const [view, setView] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem("media_trash_view");

    return saved === "list" ? "list" : "grid";
  });

  const [loading, setLoading] = useState(false);

  const loadTrash = async () => {
    try {
      setLoading(true);

      const response = await getMediaTrash(1, 50, search, fileType);

      setMedia(response.items);

      setSelectedIds([]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, [search, fileType]);

  const handleViewChange = (value: "grid" | "list") => {
    setView(value);

    localStorage.setItem("media_trash_view", value);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === media.length) {
      setSelectedIds([]);

      return;
    }

    setSelectedIds(media.map((item) => item._id));
  };

  const handleRestore = async (id: string) => {
    if (!window.confirm("Restore this media?")) {
      return;
    }

    try {
      await restoreMedia(id);

      await loadTrash();
    } catch (error) {
      console.error(error);
    }
  };

  const handleBulkRestore = async () => {
    if (!selectedIds.length) {
      return;
    }

    if (!window.confirm(`Restore ${selectedIds.length} media files?`)) {
      return;
    }

    try {
      await bulkRestoreMedia(selectedIds);

      await loadTrash();
    } catch (error) {
      console.error(error);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (
      !window.confirm(
        "Permanently delete this media? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await permanentDeleteMedia(id);

      await loadTrash();
    } catch (error) {
      console.error(error);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (!selectedIds.length) {
      return;
    }

    if (
      !window.confirm(
        `Permanently delete ${selectedIds.length} media files? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await bulkPermanentDeleteMedia(selectedIds);

      await loadTrash();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEmptyTrash = async () => {
    if (!media.length) {
      return;
    }

    if (
      !window.confirm(
        "Empty the entire media trash? All files will be permanently deleted and cannot be restored.",
      )
    ) {
      return;
    }

    try {
      await emptyMediaTrash();

      await loadTrash();
    } catch (error) {
      console.error(error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const isImage = (item: MediaItem) => {
    return item.file_type === "image";
  };

  return (
    <div
      style={{
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              margin: "0 0 6px 0",
            }}
          >
            Media Trash
          </h1>

          <p
            style={{
              margin: "0",
              color: "#666",
            }}
          >
            {media.length} deleted media
            {media.length === 1 ? " file" : " files"}
          </p>
        </div>

        <button
          onClick={handleEmptyTrash}
          disabled={media.length === 0}
          style={{
            padding: "10px 18px",
            background: media.length === 0 ? "#ccc" : "#dc3545",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: media.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Empty Trash
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search trash..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{
            padding: "10px",
            minWidth: "260px",
            border: "1px solid #ccc",
            borderRadius: "5px",
          }}
        />

        <select
          value={fileType}
          onChange={(event) => setFileType(event.target.value)}
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "5px",
          }}
        >
          <option value="">All Media</option>

          <option value="image">Images</option>

          <option value="pdf">PDF</option>

          <option value="document">Documents</option>

          <option value="spreadsheet">Spreadsheet</option>

          <option value="other">Other</option>
        </select>

        <button onClick={selectAll} disabled={media.length === 0}>
          {selectedIds.length === media.length && media.length > 0
            ? "Unselect All"
            : "Select All"}
        </button>

        {selectedIds.length > 0 && (
          <>
            <button onClick={handleBulkRestore}>
              Restore Selected ({selectedIds.length})
            </button>

            <button
              onClick={handleBulkPermanentDelete}
              style={{
                color: "#dc3545",
              }}
            >
              Delete Permanently ({selectedIds.length})
            </button>
          </>
        )}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "5px",
          }}
        >
          <button
            onClick={() => handleViewChange("grid")}
            style={{
              background: view === "grid" ? "#0c2f55" : "#fff",
              color: view === "grid" ? "#fff" : "#333",
            }}
          >
            ▦ Grid
          </button>

          <button
            onClick={() => handleViewChange("list")}
            style={{
              background: view === "list" ? "#0c2f55" : "#fff",
              color: view === "list" ? "#fff" : "#333",
            }}
          >
            ☷ List
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div
          style={{
            marginBottom: "15px",
            padding: "10px 15px",
            background: "#f0f4f8",
            borderRadius: "6px",
          }}
        >
          {selectedIds.length} media files selected
        </div>
      )}

      {loading ? (
        <p>Loading trash...</p>
      ) : media.length === 0 ? (
        <div
          style={{
            padding: "50px",
            textAlign: "center",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "50px",
              marginBottom: "10px",
            }}
          >
            🗑️
          </div>

          <h2>Trash is Empty</h2>

          <p>Deleted media files will appear here.</p>
        </div>
      ) : view === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "18px",
          }}
        >
          {media.map((item) => (
            <div
              key={item._id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "10px",
                background: "#fff",
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item._id)}
                onChange={() => toggleSelect(item._id)}
              />

              <div
                style={{
                  height: "150px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "8px",
                  background: "#f5f5f5",
                }}
              >
                {isImage(item) ? (
                  <img
                    src={`${API_URL}${item.url}`}
                    alt={item.alt_text || item.title}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      opacity: 0.6,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: "45px",
                      opacity: 0.6,
                    }}
                  >
                    📄
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "10px",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title}
                </strong>

                <div
                  style={{
                    marginTop: "4px",
                    color: "#666",
                  }}
                >
                  {item.file_type} • {formatSize(item.file_size)}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    marginTop: "10px",
                  }}
                >
                  <button onClick={() => handleRestore(item._id)}>
                    Restore
                  </button>

                  <button
                    onClick={() => handlePermanentDelete(item._id)}
                    style={{
                      color: "#dc3545",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {media.map((item) => (
            <div
              key={item._id}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 70px 1fr 120px 120px 180px",
                gap: "15px",
                alignItems: "center",
                padding: "12px",
                borderBottom: "1px solid #ddd",
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item._id)}
                onChange={() => toggleSelect(item._id)}
              />

              {isImage(item) ? (
                <img
                  src={`${API_URL}${item.url}`}
                  alt=""
                  style={{
                    width: "60px",
                    height: "50px",
                    objectFit: "cover",
                    opacity: 0.6,
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: "30px",
                  }}
                >
                  📄
                </span>
              )}

              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.original_name}
              </span>

              <span>{item.file_type}</span>

              <span>{formatSize(item.file_size)}</span>

              <div
                style={{
                  display: "flex",
                  gap: "6px",
                }}
              >
                <button onClick={() => handleRestore(item._id)}>Restore</button>

                <button
                  onClick={() => handlePermanentDelete(item._id)}
                  style={{
                    color: "#dc3545",
                  }}
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaTrash;
