import { useEffect, useState } from "react";

import {
  getMedia,
  getMediaUrl,
  uploadMedia,
  type MediaItem,
} from "../../api/media";

interface MediaSelectorProps {
  isOpen: boolean;

  onClose: () => void;

  onSelect: (media: MediaItem) => void;

  selectedMediaId?: string;
}

const MediaSelector = ({
  isOpen,
  onClose,
  onSelect,
  selectedMediaId,
}: MediaSelectorProps) => {
  const [media, setMedia] = useState<MediaItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [search, setSearch] = useState("");

  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");

  const loadMedia = async () => {
    try {
      setLoading(true);

      const response = await getMedia(1, 100, search, "image");

      setMedia(response.items || []);
    } catch (error) {
      console.error("MEDIA SELECTOR LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "library") {
      loadMedia();
    }
  }, [isOpen, activeTab, search]);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");

      setActiveTab("library");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    try {
      setUploading(true);

      const response = await uploadMedia(files);

      let uploadedMedia: MediaItem | null = null;

      if (Array.isArray(response)) {
        uploadedMedia = response[0] || null;
      } else if (Array.isArray(response?.items)) {
        uploadedMedia = response.items[0] || null;
      } else if (Array.isArray(response?.media)) {
        uploadedMedia = response.media[0] || null;
      } else if (response?.item) {
        uploadedMedia = response.item;
      }

      if (uploadedMedia) {
        onSelect(uploadedMedia);

        return;
      }

      await loadMedia();

      setActiveTab("library");
    } catch (error) {
      console.error("MEDIA SELECTOR UPLOAD ERROR:", error);
    } finally {
      setUploading(false);

      event.target.value = "";
    }
  };

  return (
    <div
      style={{
        position: "fixed",

        inset: 0,

        background: "rgba(15, 23, 42, 0.55)",

        zIndex: 99999,

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",

          maxWidth: "900px",

          maxHeight: "90vh",

          background: "#ffffff",

          borderRadius: "10px",

          overflow: "hidden",

          display: "flex",

          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "18px 20px",

            borderBottom: "1px solid #e5e7eb",

            display: "flex",

            alignItems: "center",

            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
              }}
            >
              Select Image
            </h2>

            <small
              style={{
                color: "#64748b",
              }}
            >
              Choose from Media Library or upload from computer
            </small>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",

              background: "transparent",

              fontSize: "24px",

              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",

            gap: "10px",

            padding: "15px 20px",

            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={
              activeTab === "library"
                ? "content-primary-button"
                : "content-secondary-button"
            }
          >
            Media Library
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={
              activeTab === "upload"
                ? "content-primary-button"
                : "content-secondary-button"
            }
          >
            Upload From Computer
          </button>
        </div>

        {activeTab === "library" && (
          <div
            style={{
              padding: "15px 20px",

              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search images..."
              style={{
                width: "100%",

                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        <div
          style={{
            padding: "20px",

            overflowY: "auto",

            flex: 1,
          }}
        >
          {activeTab === "upload" && (
            <div
              style={{
                border: "1px dashed #cbd5e1",

                borderRadius: "10px",

                minHeight: "250px",

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                textAlign: "center",

                padding: "30px",
              }}
            >
              <label
                style={{
                  cursor: uploading ? "not-allowed" : "pointer",

                  display: "block",

                  opacity: uploading ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: "44px",

                    marginBottom: "10px",
                  }}
                >
                  🖼️
                </div>

                <strong>
                  {uploading ? "Uploading..." : "Click to upload image"}
                </strong>

                <p
                  style={{
                    color: "#64748b",

                    margin: "8px 0 0",
                  }}
                >
                  JPG, JPEG, PNG, WEBP or GIF
                </p>

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  multiple
                  onChange={handleUpload}
                  disabled={uploading}
                  style={{
                    display: "none",
                  }}
                />
              </label>
            </div>
          )}

          {activeTab === "library" && (
            <>
              {loading ? (
                <div
                  style={{
                    textAlign: "center",

                    padding: "50px",
                  }}
                >
                  Loading media...
                </div>
              ) : media.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",

                    padding: "50px",

                    color: "#64748b",
                  }}
                >
                  No images found.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",

                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(150px, 1fr))",

                    gap: "15px",
                  }}
                >
                  {media.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => onSelect(item)}
                      style={{
                        padding: "8px",

                        border:
                          item._id === selectedMediaId
                            ? "2px solid #2563eb"
                            : "1px solid #e5e7eb",

                        borderRadius: "8px",

                        background: "#ffffff",

                        cursor: "pointer",

                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",

                          height: "120px",

                          display: "flex",

                          alignItems: "center",

                          justifyContent: "center",

                          background: "#f8fafc",

                          borderRadius: "6px",

                          overflow: "hidden",

                          marginBottom: "8px",
                        }}
                      >
                        <img
                          src={getMediaUrl(item.url)}
                          alt={
                            item.alt_text || item.title || item.original_name
                          }
                          style={{
                            width: "100%",

                            height: "100%",

                            objectFit: "contain",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          fontSize: "13px",

                          fontWeight: 600,

                          whiteSpace: "nowrap",

                          overflow: "hidden",

                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title || item.original_name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: "15px 20px",

            borderTop: "1px solid #e5e7eb",

            display: "flex",

            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="content-secondary-button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaSelector;
