import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../api/config";
import {
  getReadingSettings,
  updateReadingSettings,
  type ReadingSettings,
} from "../../api/settings";

interface PageOption {
  id: string;
  title: string;
  slug?: string;
  source: "content" | "builder";
}

const Reading = () => {
  const [pages, setPages] = useState<PageOption[]>([]);
  const [settings, setSettings] = useState<ReadingSettings>({
    homepage_type: "latest_posts",
    homepage_id: "",
    posts_page_id: "",
    posts_per_page: 10,
    feed_items: 10,
    feed_content: "excerpt",
    search_engine_visibility: false,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const headers = { Authorization: `Bearer ${token}` };

        const [pagesRes, builderRes, readingRes] = await Promise.all([
          axios.get(`${API_URL}/api/content/pages`, {
            params: { published_only: true },
            headers,
          }),
          axios
            .get(`${API_URL}/api/page-builder`, {
              params: { status: "published" },
              headers,
            })
            .catch(() => ({ data: [] })),
          getReadingSettings(),
        ]);

        const contentPages: PageOption[] = (pagesRes.data.pages || []).map(
          (p: any) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            source: "content",
          })
        );

        const builderPages: PageOption[] = (builderRes.data || [])
          .filter(
            (p: any) =>
              p.template_type === "page" ||
              !p.template_type ||
              p.template_type === "page"
          )
          .map((p: any) => ({
            id: p.id,
            title: `[Builder] ${p.title}`,
            slug: p.slug,
            source: "builder",
          }));

        setPages([...contentPages, ...builderPages]);
        setSettings(readingRes);
      } catch (err) {
        console.error("READING SETTINGS ERROR:", err);
        setError("Unable to load reading settings.");
      }
    };

    void loadData();
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
    } catch (err) {
      console.error("SAVE READING SETTINGS ERROR:", err);
      setError("Unable to save reading settings.");
    }
  };

  // Find selected page for URL preview
  const selectedPage = pages.find((p) => p.id === settings.homepage_id);

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

                {selectedPage?.slug && (
                  <small
                    style={{
                      display: "block",
                      marginTop: 6,
                      color: "#666",
                      fontSize: 12,
                    }}
                  >
                    Permalink:{" "}
                    <code>
                      {window.location.origin}/{selectedPage.slug}
                    </code>
                  </small>
                )}
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
            <label htmlFor="posts-per-page">Blog pages show at most</label>
            <input
              id="posts-per-page"
              type="number"
              min={1}
              max={100}
              value={settings.posts_per_page}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  posts_per_page: Number(event.target.value),
                })
              }
            />
            <span>posts</span>
          </div>

          <div className="content-form-group">
            <label htmlFor="feed-items">Syndication feeds show the most recent</label>
            <input
              id="feed-items"
              type="number"
              min={1}
              max={100}
              value={settings.feed_items}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  feed_items: Number(event.target.value),
                })
              }
            />
            <span>items</span>
          </div>

          <div className="content-form-group">
            <label htmlFor="feed-content">For each post in a feed, include</label>
            <select
              id="feed-content"
              value={settings.feed_content}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  feed_content: event.target.value as "full" | "excerpt",
                })
              }
            >
              <option value="excerpt">Excerpt</option>
              <option value="full">Full text</option>
            </select>
          </div>

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