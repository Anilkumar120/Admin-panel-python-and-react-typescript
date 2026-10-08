import { useEffect, useState } from "react";

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
  const API_URL = import.meta.env.VITE_API_URL;

  const navigate = useNavigate();

  const [media, setMedia] = useState<MediaItem[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const [view, setView] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem("media_view");

    return saved === "list" ? "list" : "grid";
  });

  const [search, setSearch] = useState("");

  const [fileType, setFileType] = useState("");

  const [loading, setLoading] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [uploadTotal, setUploadTotal] = useState(0);

  const [uploadCompleted, setUploadCompleted] = useState(0);

  const [uploadSuccess, setUploadSuccess] = useState(0);

  const [uploadFailed, setUploadFailed] = useState(0);

  const loadMedia = async () => {
    try {
      setLoading(true);

      const response = await getMedia(1, 50, search, fileType);

      setMedia(response.items);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [search, fileType]);

  const handleViewChange = (value: "grid" | "list") => {
    setView(value);

    localStorage.setItem("media_view", value);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    const batchSize = 20;

    try {
      setUploading(true);

      setUploadTotal(files.length);

      setUploadCompleted(0);

      setUploadSuccess(0);

      setUploadFailed(0);

      for (let index = 0; index < files.length; index += batchSize) {
        const batch = files.slice(index, index + batchSize);

        try {
          await uploadMedia(batch);

          setUploadSuccess((current) => current + batch.length);
        } catch (error) {
          console.error(error);

          setUploadFailed((current) => current + batch.length);
        }

        setUploadCompleted((current) => current + batch.length);

        await loadMedia();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);

      event.target.value = "";
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
    if (selectedIds.length === media.length) {
      setSelectedIds([]);

      return;
    }

    setSelectedIds(media.map((item) => item._id));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Move this media to trash?")) {
      return;
    }

    try {
      await deleteMedia(id);

      await loadMedia();

      setSelectedIds((current) => current.filter((item) => item !== id));

      if (selectedMedia?._id === id) {
        setSelectedMedia(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) {
      return;
    }

    if (!window.confirm(`Move ${selectedIds.length} media files to trash?`)) {
      return;
    }

    try {
      await bulkDeleteMedia(selectedIds);

      setSelectedIds([]);

      await loadMedia();
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

  const handleMediaClick = (item: MediaItem) => {
    setSelectedMedia(item);
  };

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
        <h1>Media Library</h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button
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
            }}
          >
            {uploading
              ? `Uploading ${uploadCompleted} / ${uploadTotal}`
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

      {uploading && (
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
            <strong>Uploading Media</strong>

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
              gap: "20px",
              marginTop: "10px",
              fontSize: "14px",
            }}
          >
            <span>
              Completed: {uploadCompleted} / {uploadTotal}
            </span>

            <span>Success: {uploadSuccess}</span>

            <span>Failed: {uploadFailed}</span>
          </div>
        </div>
      )}

      {!uploading && uploadTotal > 0 && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 15px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            background: "#fafafa",
          }}
        >
          Upload completed: {uploadSuccess} successful
          {uploadFailed > 0 && `, ${uploadFailed} failed`}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Search media..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{
            padding: "10px",
            minWidth: "260px",
          }}
        />

        <select
          value={fileType}
          onChange={(event) => setFileType(event.target.value)}
          style={{
            padding: "10px",
          }}
        >
          <option value="">All Media</option>

          <option value="image">Images</option>

          <option value="pdf">PDF</option>

          <option value="document">Documents</option>

          <option value="spreadsheet">Spreadsheet</option>

          <option value="other">Other</option>
        </select>

        <button onClick={selectAll}>
          {selectedIds.length === media.length && media.length > 0
            ? "Unselect All"
            : "Select All"}
        </button>

        {selectedIds.length > 0 && (
          <button onClick={handleBulkDelete}>
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
          <button onClick={() => handleViewChange("grid")}>▦ Grid</button>

          <button onClick={() => handleViewChange("list")}>☷ List</button>
        </div>
      </div>

      {loading ? (
        <p>Loading media...</p>
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
              }}
              onClick={() => handleMediaClick(item)}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item._id)}
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
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: "45px",
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
                <strong>{item.title}</strong>

                <div>{formatSize(item.file_size)}</div>

                <button
                  onClick={(event) => {
                    event.stopPropagation();

                    handleDelete(item._id);
                  }}
                  style={{
                    marginTop: "8px",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {media.map((item) => (
            <div
              key={item._id}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 70px 1fr 120px 120px 100px",
                gap: "15px",
                alignItems: "center",
                padding: "10px",
                borderBottom: "1px solid #ddd",
                cursor: "pointer",
              }}
              onClick={() => handleMediaClick(item)}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item._id)}
                onClick={(event) => event.stopPropagation()}
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
                  }}
                />
              ) : (
                <span>📄</span>
              )}

              <span>{item.original_name}</span>

              <span>{item.file_type}</span>

              <span>{formatSize(item.file_size)}</span>

              <button
                onClick={(event) => {
                  event.stopPropagation();

                  handleDelete(item._id);
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
