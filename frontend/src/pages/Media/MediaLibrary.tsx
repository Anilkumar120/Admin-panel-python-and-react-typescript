import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getMedia,
  uploadMedia,
  deleteMedia,
  bulkDeleteMedia,
  type MediaItem,
} from "../../api/media";

import MediaDetails from "../../components/Media/MediaDetails";

const MediaLibrary = () => {
  const API_URL = String(import.meta.env.VITE_API_URL || "/api").replace(
    /\/+$/,
    "",
  );

  const navigate = useNavigate();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const [view, setView] = useState<"grid" | "list">(() => {
    try {
      return localStorage.getItem("media_view") === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });

  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadCompleted, setUploadCompleted] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(0);
  const [uploadFailed, setUploadFailed] = useState(0);

  // Convert relative media URLs into valid URLs.
  const getMediaUrl = (url?: string | null) => {
    if (!url) return "";

    if (/^https?:\/\//i.test(url) || url.startsWith("data:")) {
      return url;
    }

    // GridFS URLs returned by the backend already contain /api.
    if (url.startsWith("/api/")) {
      return url;
    }

    // VITE_API_URL may be /api or a full backend URL ending in /api.
    const path = url.startsWith("/") ? url : `/${url}`;

    if (API_URL.endsWith("/api") && path.startsWith("/api/")) {
      return `${API_URL.slice(0, -4)}${path}`;
    }

    return `${API_URL}${path}`;
  };

  // Load media from the API.
  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await getMedia(1, 50, search.trim(), fileType);

      if (!response || !Array.isArray(response.items)) {
        console.error("Unexpected media API response:", response);
        setMedia([]);
        setErrorMessage(
          "Media API response format is incorrect. Please check api/media.ts.",
        );
        return;
      }

      setMedia(response.items);

      // Remove selections for media that are no longer in the list.
      const availableIds = new Set(
        response.items.map((item: MediaItem) => item._id),
      );

      setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
    } catch (error) {
      console.error("Failed to load media:", error);
      setErrorMessage(
        "Unable to load media. Please check the API request in your browser Network tab.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, fileType]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const handleViewChange = (value: "grid" | "list") => {
    setView(value);

    try {
      localStorage.setItem("media_view", value);
    } catch (error) {
      console.warn("Unable to save media view preference:", error);
    }
  };

  // Upload files in small batches.
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);

    if (!files.length) return;

    const batchSize = 5;

    setUploading(true);
    setUploadTotal(files.length);
    setUploadCompleted(0);
    setUploadSuccess(0);
    setUploadFailed(0);
    setErrorMessage("");

    let successful = 0;
    let failed = 0;

    try {
      for (let index = 0; index < files.length; index += batchSize) {
        const batch = files.slice(index, index + batchSize);

        try {
          await uploadMedia(batch);
          successful += batch.length;
        } catch (error) {
          console.error("Media upload failed:", error);
          failed += batch.length;
        }

        setUploadSuccess(successful);
        setUploadFailed(failed);
        setUploadCompleted(Math.min(index + batch.length, files.length));
      }

      // Refresh the library after all batches have been processed.
      await loadMedia();

      if (failed > 0) {
        setErrorMessage(
          `${failed} file(s) failed to upload. Check the browser Console and Network tab for details.`,
        );
      }
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const selectAll = () => {
    const allVisibleSelected =
      media.length > 0 && media.every((item) => selectedIds.includes(item._id));

    if (allVisibleSelected) {
      const visibleIds = new Set(media.map((item) => item._id));
      setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }

    setSelectedIds((current) => [
      ...new Set([...current, ...media.map((item) => item._id)]),
    ]);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Move this media to trash?")) return;

    try {
      setErrorMessage("");
      await deleteMedia(id);

      setMedia((current) => current.filter((item) => item._id !== id));
      setSelectedIds((current) => current.filter((item) => item !== id));

      if (selectedMedia?._id === id) {
        setSelectedMedia(null);
      }

      await loadMedia();
    } catch (error) {
      console.error("Failed to delete media:", error);
      setErrorMessage("Unable to delete media. Please try again.");
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    if (!window.confirm(`Move ${selectedIds.length} media file(s) to trash?`)) {
      return;
    }

    try {
      setErrorMessage("");
      await bulkDeleteMedia(selectedIds);

      setSelectedIds([]);
      setSelectedMedia(null);

      await loadMedia();
    } catch (error) {
      console.error("Bulk media delete failed:", error);
      setErrorMessage("Unable to delete selected media. Please try again.");
    }
  };

  const formatSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const isImage = (item: MediaItem) => item.file_type === "image";

  const handleMediaUpdated = (updatedMedia: MediaItem) => {
    setMedia((current) =>
      current.map((item) =>
        item._id === updatedMedia._id ? updatedMedia : item,
      ),
    );

    setSelectedMedia(updatedMedia);
  };

  const uploadProgress =
    uploadTotal > 0 ? Math.round((uploadCompleted / uploadTotal) * 100) : 0;

  const allVisibleSelected =
    media.length > 0 && media.every((item) => selectedIds.includes(item._id));

  return (
    <div style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ margin: 0 }}>Media Library</h1>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => navigate("/admin/media/trash")}
            style={{
              padding: "10px 18px",
              background: "#dc3545",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            🗑 Trash
          </button>

          <label
            style={{
              cursor: uploading ? "not-allowed" : "pointer",
              padding: "10px 18px",
              background: uploading ? "#999" : "#0c2f55",
              color: "#fff",
              borderRadius: "6px",
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading
              ? `Uploading ${uploadCompleted}/${uploadTotal}`
              : "+ Upload Files"}

            <input
              type="file"
              multiple
              hidden
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>
      </div>

      {uploadTotal > 0 && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            background: "#fafafa",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <strong>{uploading ? "Uploading Media" : "Upload Summary"}</strong>
            <span>{uploadProgress}%</span>
          </div>

          <div
            style={{
              width: "100%",
              height: "8px",
              background: "#e5e5e5",
              borderRadius: "5px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${uploadProgress}%`,
                height: "100%",
                background: "#0c2f55",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "20px",
              marginTop: "10px",
              fontSize: "14px",
            }}
          >
            <span>
              Completed: {uploadCompleted}/{uploadTotal}
            </span>
            <span>Success: {uploadSuccess}</span>
            <span>Failed: {uploadFailed}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            padding: "12px 15px",
            border: "1px solid #f1b7b7",
            borderRadius: "6px",
            color: "#842029",
            background: "#f8d7da",
          }}
        >
          {errorMessage}
          <button
            type="button"
            onClick={() => void loadMedia()}
            style={{ marginLeft: "12px" }}
          >
            Retry
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <input
          type="search"
          placeholder="Search media..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search media"
          style={{
            padding: "10px",
            minWidth: "260px",
            maxWidth: "100%",
          }}
        />

        <select
          value={fileType}
          onChange={(event) => setFileType(event.target.value)}
          aria-label="Filter media type"
          style={{ padding: "10px" }}
        >
          <option value="">All Media</option>
          <option value="image">Images</option>
          <option value="pdf">PDF</option>
          <option value="document">Documents</option>
          <option value="spreadsheet">Spreadsheet</option>
          <option value="other">Other</option>
        </select>

        <button type="button" onClick={selectAll} disabled={!media.length}>
          {allVisibleSelected ? "Unselect All" : "Select All"}
        </button>

        {selectedIds.length > 0 && (
          <button type="button" onClick={handleBulkDelete}>
            Delete Selected ({selectedIds.length})
          </button>
        )}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "5px",
          }}
        >
          <button
            type="button"
            onClick={() => handleViewChange("grid")}
            aria-pressed={view === "grid"}
          >
            ▦ Grid
          </button>

          <button
            type="button"
            onClick={() => handleViewChange("list")}
            aria-pressed={view === "list"}
          >
            ☷ List
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading media...</p>
      ) : media.length === 0 ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            border: "1px dashed #ccc",
            borderRadius: "8px",
            color: "#666",
          }}
        >
          <div style={{ fontSize: "42px", marginBottom: "10px" }}>📂</div>
          <h3 style={{ margin: "0 0 8px" }}>No media found</h3>
          <p style={{ margin: 0 }}>
            Upload files or change your search and filter settings.
          </p>
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
                position: "relative",
                cursor: "pointer",
                minWidth: 0,
              }}
              onClick={() => setSelectedMedia(item)}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item._id)}
                aria-label={`Select ${item.title}`}
                onClick={(event) => event.stopPropagation()}
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
                  overflow: "hidden",
                }}
              >
                {isImage(item) ? (
                  <img
                    src={getMediaUrl(item.url)}
                    alt={item.alt_text || item.title}
                    loading="lazy"
                    onError={(event) => {
                      console.error("Media image failed to load:", {
                        url: item.url,
                        resolvedUrl: getMediaUrl(item.url),
                      });
                      event.currentTarget.style.display = "none";
                    }}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: "45px" }}>📄</div>
                )}
              </div>

              <div style={{ marginTop: "10px", overflowWrap: "anywhere" }}>
                <strong>{item.title || item.original_name}</strong>
                <div>{formatSize(item.file_size)}</div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDelete(item._id);
                  }}
                  style={{ marginTop: "8px" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          {media.map((item) => (
            <div
              key={item._id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "40px 70px minmax(160px, 1fr) 120px 120px 100px",
                gap: "15px",
                alignItems: "center",
                padding: "10px",
                borderBottom: "1px solid #ddd",
                cursor: "pointer",
                minWidth: "650px",
              }}
              onClick={() => setSelectedMedia(item)}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item._id)}
                aria-label={`Select ${item.title}`}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggleSelect(item._id)}
              />

              {isImage(item) ? (
                <img
                  src={getMediaUrl(item.url)}
                  alt={item.alt_text || item.title}
                  loading="lazy"
                  onError={(event) => {
                    console.error("Media image failed to load:", item.url);
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    width: "60px",
                    height: "50px",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span>📄</span>
              )}

              <span style={{ overflowWrap: "anywhere" }}>
                {item.original_name || item.title}
              </span>

              <span>{item.file_type}</span>
              <span>{formatSize(item.file_size)}</span>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDelete(item._id);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <MediaDetails
        media={selectedMedia}
        onClose={() => setSelectedMedia(null)}
        onUpdated={handleMediaUpdated}
      />
    </div>
  );
};

export default MediaLibrary;
