import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  getSiteIdentity,
  updateSiteIdentity,
  type SiteIdentity as SiteIdentityData,
} from "../../api/siteIdentity";
import { getMediaUrl } from "../../api/media";
import MediaPicker, { type PickedMedia } from "../admin/MediaPicker";

const EMPTY_IDENTITY: SiteIdentityData = {
  logo_url: "",
  favicon_url: "",
};

const SiteIdentity = () => {
  const [identity, setIdentity] = useState(EMPTY_IDENTITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<
    "logo_url" | "favicon_url" | null
  >(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setIdentity(await getSiteIdentity());
      } catch (loadError) {
        console.error("SITE IDENTITY LOAD ERROR:", loadError);
        setError("Unable to load site identity settings.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleMediaSelect = (media: PickedMedia | PickedMedia[]) => {
    if (!mediaTarget) return;
    const selected = Array.isArray(media) ? media[0] : media;
    setIdentity((current) => ({ ...current, [mediaTarget]: selected.url }));
    setMediaTarget(null);
    setError("");
  };

  const handleMediaError = useCallback((uploadError: unknown) => {
    console.error("SITE IDENTITY MEDIA ERROR:", uploadError);
    const detail = axios.isAxiosError(uploadError)
      ? uploadError.response?.data?.detail
      : undefined;
    setError(
      typeof detail === "string"
        ? detail
        : "Unable to load or upload site identity media.",
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateSiteIdentity(identity);
      setMessage("Site identity saved.");
      window.dispatchEvent(new Event("site-identity-updated"));
    } catch (saveError) {
      console.error("SITE IDENTITY SAVE ERROR:", saveError);
      setError("Unable to save site identity settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="content-page">Loading site identity settings...</div>;
  }

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Site Identity</h1>
          <p>Set the logo and browser tab icon used across your site.</p>
        </div>
      </div>

      <div className="content-card">
        <div className="content-form">
          {(
            [
              ["logo_url", "Site Logo", "Displayed in the public site header."],
              [
                "favicon_url",
                "Site Icon (Favicon)",
                "Displayed in the browser tab. A square PNG or SVG works best.",
              ],
            ] as const
          ).map(([field, title, description]) => (
            <div className="content-form-group" key={field}>
              <label>{title}</label>
              <p>{description}</p>
              {identity[field] && (
                <div style={{ margin: "12px 0" }}>
                  <img
                    src={getMediaUrl(identity[field])}
                    alt={`${title} preview`}
                    style={{
                      width: field === "favicon_url" ? 64 : "auto",
                      height: field === "favicon_url" ? 64 : 100,
                      maxWidth: 280,
                      objectFit: "contain",
                      border: "1px solid #d9e2ec",
                      borderRadius: 6,
                      padding: 8,
                    }}
                  />
                </div>
              )}
              <button
                type="button"
                className="content-secondary-button"
                onClick={() => setMediaTarget(field)}
              >
                Choose from Media Library or Upload
              </button>
              {identity[field] && (
                <button
                  type="button"
                  className="content-secondary-button"
                  onClick={() =>
                    setIdentity((current) => ({ ...current, [field]: "" }))
                  }
                  style={{ marginTop: 8 }}
                >
                  Remove {title}
                </button>
              )}
            </div>
          ))}

          {error && <div className="content-message-error">{error}</div>}
          {message && <div className="content-message-success">{message}</div>}

          <div className="content-form-actions">
            <button
              type="button"
              className="content-primary-button"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
        <MediaPicker
          isOpen={mediaTarget !== null}
          onClose={() => setMediaTarget(null)}
          onSelect={handleMediaSelect}
          onError={handleMediaError}
          fileType="image"
        />
      </div>
    </div>
  );
};

export default SiteIdentity;
