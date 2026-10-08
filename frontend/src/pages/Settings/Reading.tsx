import { useEffect, useState } from "react";

import { getPages } from "../../api/content";

import {
  getReadingSettings,
  updateReadingSettings,
  type ReadingSettings,
} from "../../api/settings";

interface PageOption {
  id: string;

  title: string;
}

const Reading = () => {
  const [pages, setPages] = useState<PageOption[]>([]);

  const [settings, setSettings] = useState<ReadingSettings>({
    homepage_type: "latest_posts",
    homepage_id: "",
    posts_page_id: "",
    search_engine_visibility: false,
  });

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [pageResponse, readingResponse] = await Promise.all([
          getPages(false, true),
          getReadingSettings(),
        ]);

        setPages(pageResponse);

        setSettings(readingResponse);
      } catch (error) {
        console.log("READING SETTINGS ERROR:", error);

        setError("Unable to load reading settings.");
      }
    };

    loadData();
  }, []);

  const handleSave = async () => {
    if (settings.homepage_type === "static" && !settings.homepage_id) {
      setError("Select a published page for the homepage.");

      setMessage("");

      return;
    }

    try {
      setError("");

      setMessage("");

      await updateReadingSettings(settings);

      setMessage("Reading settings saved successfully.");
    } catch (error) {
      console.log("SAVE READING SETTINGS ERROR:", error);

      setError("Unable to save reading settings.");
    }
  };

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Reading Settings</h1>

          <p>Manage your homepage and posts page</p>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h2>Homepage Settings</h2>

            <p>
              Choose whether your homepage shows recent posts or a published
              page.
            </p>
          </div>
        </div>

        <div className="content-form">
          <div className="content-form-group">
            <label>Homepage displays</label>

            <label>
              <input
                type="radio"
                name="homepage_type"
                value="latest_posts"
                checked={settings.homepage_type === "latest_posts"}
                onChange={() =>
                  setSettings({
                    ...settings,
                    homepage_type: "latest_posts",
                    homepage_id: "",
                  })
                }
              />{" "}
              Your latest posts
            </label>

            <label>
              <input
                type="radio"
                name="homepage_type"
                value="static"
                checked={settings.homepage_type === "static"}
                onChange={() =>
                  setSettings({
                    ...settings,
                    homepage_type: "static",
                  })
                }
              />{" "}
              A static page (select a published page)
            </label>
          </div>

          {settings.homepage_type === "static" && (
            <>
              <div className="content-form-group">
                <label>Homepage</label>

                <select
                  value={settings.homepage_id}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      homepage_id: event.target.value,
                    })
                  }
                >
                  <option value="">
                    {pages.length
                      ? "Select a published page"
                      : "No published pages available"}
                  </option>

                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="content-form-group">
                <label>Posts Page</label>

                <select
                  value={settings.posts_page_id}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      posts_page_id: event.target.value,
                    })
                  }
                >
                  <option value="">Select Posts Page</option>

                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="content-form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.search_engine_visibility}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    search_engine_visibility: event.target.checked,
                  })
                }
              />{" "}
              Discourage search engines from indexing this site
            </label>
          </div>

          {error && <div className="content-message-error">{error}</div>}

          {message && <div className="content-message-success">{message}</div>}

          <div className="content-form-actions">
            <button
              type="button"
              className="content-primary-button"
              onClick={handleSave}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reading;
