import { useEffect, useState } from "react";
import {
  getPermalinkSettings,
  updatePermalinkSettings,
  type PermalinkSettings,
} from "../../api/settings";

const defaults: PermalinkSettings = {
  structure: "post_name",
  custom_structure: "/%category%/%postname%/",
  category_base: "",
  tag_base: "",
  product_base: "products",
};

const Permalinks = () => {
  const [settings, setSettings] = useState(defaults);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getPermalinkSettings()
      .then(setSettings)
      .catch((loadError: unknown) => {
        console.error("LOAD PERMALINK SETTINGS ERROR:", loadError);
        setError("Unable to load permalink settings.");
      });
  }, []);

  const save = async () => {
    try {
      setError("");
      setMessage("");
      await updatePermalinkSettings(settings);
      setMessage("Permalink settings saved successfully.");
    } catch (saveError: unknown) {
      console.error("SAVE PERMALINK SETTINGS ERROR:", saveError);
      setError("Unable to save permalink settings. Check the custom structure.");
    }
  };

  const structureExamples: Record<PermalinkSettings["structure"], string> = {
    plain: `${window.location.origin}/?p=123`,
    day_name: `${window.location.origin}/2025/03/08/sample-post/`,
    month_name: `${window.location.origin}/2025/03/sample-post/`,
    numeric: `${window.location.origin}/archives/123`,
    post_name: `${window.location.origin}/sample-post/`,
    custom: `${window.location.origin}${settings.custom_structure.replace(
      "%year%",
      "2025",
    ).replace("%monthnum%", "03").replace("%day%", "08").replace("%postname%", "sample-post").replace("%category%", "news").replace("%author%", "admin").replace("%post_id%", "123").replace("%hour%", "12").replace("%minute%", "30").replace("%second%", "45")}`,
  };

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Permalink Settings</h1>
          <p>Choose how post and product URLs are structured.</p>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h2>Common Settings</h2>
            <p>Choose a URL structure for published content.</p>
          </div>
        </div>
        <div className="content-form permalink-settings-form">
          {(
            [
              ["plain", "Plain"],
              ["day_name", "Day and name"],
              ["month_name", "Month and name"],
              ["numeric", "Numeric"],
              ["post_name", "Post name"],
              ["custom", "Custom structure"],
            ] as const
          ).map(([value, label]) => (
            <label className="permalink-option" key={value}>
              <input
                type="radio"
                name="permalink-structure"
                checked={settings.structure === value}
                onChange={() => setSettings({ ...settings, structure: value })}
              />
              <span>{label}</span>
              {value === "custom" ? (
                <input
                  aria-label="Custom permalink structure"
                  type="text"
                  value={settings.custom_structure}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      custom_structure: event.target.value,
                    })
                  }
                  placeholder="/%category%/%postname%/"
                />
              ) : (
                <code>{structureExamples[value]}</code>
              )}
            </label>
          ))}

          {settings.structure === "custom" && (
            <p className="permalink-tokens">
              Available: %year%, %monthnum%, %day%, %hour%, %minute%,
              %second%, %post_id%, %postname%, %category%, %author%.
            </p>
          )}

          <div className="content-form-group">
            <label htmlFor="category-base">Optional category base</label>
            <input
              id="category-base"
              value={settings.category_base}
              onChange={(event) =>
                setSettings({ ...settings, category_base: event.target.value })
              }
              placeholder="category"
            />
          </div>
          <div className="content-form-group">
            <label htmlFor="tag-base">Optional tag base</label>
            <input
              id="tag-base"
              value={settings.tag_base}
              onChange={(event) =>
                setSettings({ ...settings, tag_base: event.target.value })
              }
              placeholder="tag"
            />
          </div>
          <div className="content-form-group">
            <label htmlFor="product-base">Product URL base</label>
            <input
              id="product-base"
              value={settings.product_base}
              onChange={(event) =>
                setSettings({ ...settings, product_base: event.target.value })
              }
              placeholder="products"
            />
          </div>

          {error && <div className="content-message-error">{error}</div>}
          {message && <div className="content-message-success">{message}</div>}
          <div className="content-form-actions">
            <button
              type="button"
              className="content-primary-button"
              onClick={save}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Permalinks;
