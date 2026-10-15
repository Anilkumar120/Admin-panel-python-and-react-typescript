import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getMedia,
  uploadMedia,
  getMediaUrl,
  type MediaItem,
} from "../../api/media";

export interface PickedMedia {
  id: string;
  url: string;
  alt: string;
  title: string;
  fileName: string;
  mimeType: string;
  width?: number;
  height?: number;
}

interface MediaPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: PickedMedia | PickedMedia[]) => void;
  onError?: (error: unknown) => void;
  multiple?: boolean;
  fileType?: "image" | "video" | "all";
}

const MediaPicker = ({
  isOpen,
  onClose,
  onSelect,
  onError,
  multiple = false,
  fileType = "image",
}: MediaPickerProps) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load media
  useEffect(() => {
    if (!isOpen) return;

    const loadMedia = async () => {
      setLoading(true);
      setError("");
      try {
        const filterType = fileType === "all" ? "" : fileType;
        const response = await getMedia(1, 100, search, filterType);
        setMedia(response.items || []);
      } catch (err) {
        console.error("Media load error:", err);
        setError("Failed to load media.");
        setMedia([]);
        onError?.(err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      void loadMedia();
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [isOpen, search, fileType, onError]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelected([]);
      setSearch("");
      setError("");
      setActiveTab("library");
    }
  }, [isOpen]);

  // Upload handler
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");

    try {
      const fileArray = Array.from(files);
      const response = await uploadMedia(fileArray);

      // Reload media list
      const refreshed = await getMedia(1, 100, "", fileType === "all" ? "" : fileType);
      setMedia(refreshed.items || []);

      // Auto-select if single
      if (!multiple && response && response.items?.length > 0) {
        const uploaded = response.items[0];
        onSelect(convertToPickedMedia(uploaded));
        onClose();
      } else {
        setActiveTab("library");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Upload failed. Please try again.");
      onError?.(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const convertToPickedMedia = (item: MediaItem): PickedMedia => ({
    id: item._id,
    url: getMediaUrl(item.url),
    alt: item.alt_text || item.title || item.file_name,
    title: item.title || item.file_name,
    fileName: item.original_name || item.file_name,
    mimeType: item.mime_type || "image/jpeg",
  });

  const toggleSelect = (item: MediaItem) => {
    if (multiple) {
      setSelected((prev) => {
        const exists = prev.find((m) => m._id === item._id);
        if (exists) return prev.filter((m) => m._id !== item._id);
        return [...prev, item];
      });
    } else {
      setSelected([item]);
    }
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;

    if (multiple) {
      onSelect(selected.map(convertToPickedMedia));
    } else {
      onSelect(convertToPickedMedia(selected[0]));
    }
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="media-picker-overlay" onClick={onClose}>
      <div className="media-picker" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="media-picker-header">
          <h3>Select Media</h3>
          <button
            type="button"
            className="media-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="media-picker-tabs">
          <button
            type="button"
            className={activeTab === "library" ? "active" : ""}
            onClick={() => setActiveTab("library")}
          >
            📁 Media Library
          </button>
          <button
            type="button"
            className={activeTab === "upload" ? "active" : ""}
            onClick={() => setActiveTab("upload")}
          >
            ⬆ Upload New
          </button>
        </div>

        {/* Body */}
        <div className="media-picker-body">
          {error && <div className="media-error">{error}</div>}

          {activeTab === "library" && (
            <>
              <input
                type="text"
                className="media-search"
                placeholder="Search media by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {loading ? (
                <div className="media-loading">Loading media...</div>
              ) : media.length === 0 ? (
                <div className="media-empty">
                  <p>No media found.</p>
                  <button
                    type="button"
                    className="media-upload-btn"
                    onClick={() => setActiveTab("upload")}
                  >
                    Upload Your First File
                  </button>
                </div>
              ) : (
                <div className="media-grid">
                  {media.map((item) => {
                    const isSelected = selected.some((s) => s._id === item._id);
                    const isImage = item.file_type === "image" ||
                                   item.mime_type?.startsWith("image/");

                    return (
                      <div
                        key={item._id}
                        className={`media-item ${isSelected ? "selected" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleSelect(item);
                          }
                        }}
                        onClick={() => toggleSelect(item)}
                      >
                        {isImage ? (
                          <img
                            src={getMediaUrl(item.url)}
                            alt={item.alt_text || item.file_name}
                            loading="lazy"
                          />
                        ) : (
                          <div className="media-item-video-icon">🎬</div>
                        )}
                        <div className="media-item-name" title={item.original_name}>
                          {item.original_name || item.file_name}
                        </div>
                        {isSelected && (
                          <div className="media-item-check">✓</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === "upload" && (
            <div className="media-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  fileType === "image"
                    ? "image/*"
                    : fileType === "video"
                    ? "video/*"
                    : "image/*,video/*"
                }
                multiple
                onChange={(e) => handleUpload(e.target.files)}
                style={{ display: "none" }}
              />
              <div
                className="media-dropzone"
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!uploading) handleUpload(e.dataTransfer.files);
                }}
              >
                {uploading ? (
                  <>
                    <div className="dropzone-icon spin">⏳</div>
                    <p>Uploading...</p>
                  </>
                ) : (
                  <>
                    <div className="dropzone-icon">⬆</div>
                    <p>Click or drag files here</p>
                    <small>
                      {fileType === "image"
                        ? "Images only (JPG, PNG, GIF, WebP)"
                        : fileType === "video"
                        ? "Videos only"
                        : "Images and videos"}
                    </small>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="media-picker-footer">
          <div className="media-selected-count">
            {selected.length > 0 && `${selected.length} selected`}
          </div>
          <div className="media-picker-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={selected.length === 0}
              onClick={handleConfirm}
            >
              {multiple ? `Insert ${selected.length}` : "Insert Media"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MediaPicker;