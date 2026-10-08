import { useEffect, useState } from "react";
import { type MediaItem, updateMedia } from "../../api/media";
import { getImageUrl } from "../../api/products";

interface MediaDetailsProps {
  media: MediaItem | null;
  onClose: () => void;
  onUpdated: (media: MediaItem) => void;
}

const MediaDetails = ({ media, onClose, onUpdated }: MediaDetailsProps) => {
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!media) {
      return;
    }

    setTitle(media.title || "");
    setAltText(media.alt_text || "");
    setDescription(media.description || "");
  }, [media]);

  if (!media) {
    return null;
  }

  const imageUrl = getImageUrl(media.url);
  const handleSave = async () => {
    try {
      setSaving(true);

      await updateMedia(media._id, title, altText, description);

      onUpdated({
        ...media,
        title,
        alt_text: altText,
        description,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="media-details-overlay" onClick={onClose}>
      <div
        className="media-details-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="media-details-header">
          <h2>Media Details</h2>

          <button className="media-details-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="media-details-content">
          <div className="media-details-preview">
            {media.file_type === "image" ? (
              <img src={imageUrl} alt={media.alt_text || media.title} />
            ) : (
              <div className="media-details-file-icon">
                {media.extension.toUpperCase()}
              </div>
            )}
          </div>

          <div className="media-details-field">
            <label>Title</label>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="media-details-field">
            <label>Alt Text</label>

            <input
              type="text"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
            />
          </div>

          <div className="media-details-field">
            <label>Description</label>

            <textarea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="media-details-field">
            <label>URL</label>

            <div className="media-details-url">
              <input type="text" value={imageUrl} readOnly />

              <button type="button" onClick={handleCopyUrl}>
                Copy
              </button>
            </div>
          </div>

          <div className="media-details-field">
            <label>File Name</label>

            <input type="text" value={media.original_name} readOnly />
          </div>

          <div className="media-details-field">
            <label>File Type</label>

            <input type="text" value={media.file_type} readOnly />
          </div>

          <div className="media-details-field">
            <label>Size</label>

            <input
              type="text"
              value={`${(media.file_size / 1024 / 1024).toFixed(2)} MB`}
              readOnly
            />
          </div>
        </div>

        <div className="media-details-footer">
          <button className="media-details-cancel" onClick={onClose}>
            Cancel
          </button>

          <button
            className="media-details-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaDetails;
