import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../api/config";
import BuilderRenderer from "../../components/ContentRenderer/BuilderRenderer";
import type { ResponsiveDevice } from "../../types/pageBuilder";
import PublicPageView from "./PublicPageView";

const useDevice = (): ResponsiveDevice => {
  const [device, setDevice] = useState<ResponsiveDevice>("desktop");
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice("mobile");
      else if (w < 1024) setDevice("tablet");
      else setDevice("desktop");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return device;
};

const HomePage = () => {
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const device = useDevice();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/public/homepage-full`);
        console.log("🏠 Homepage response:", res.data);
        setPageData(res.data);
      } catch (err) {
        console.error("❌ Homepage load error:", err);
        setPageData({ source_type: "latest_posts" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (new URLSearchParams(window.location.search).has("p")) {
    return <PublicPageView />;
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#888" }}>
        Loading...
      </div>
    );
  }

  if (!pageData) return null;

  // ============ BUILDER PAGE ============
  if (
    pageData.source_type === "builder" &&
    Array.isArray(pageData.layout)
  ) {
    const showTitle = pageData.show_title !== false;
    return (
      <div className="public-builder-view">
        {showTitle && pageData.title && (
          <div className="public-page-title">
            <h1>{pageData.title}</h1>
          </div>
        )}
        <BuilderRenderer
          layout={pageData.layout}
          device={device}
          pageId={String(pageData.id || pageData.page_id || pageData.slug || "homepage")}
          pageTitle={pageData.title || ""}
        />
      </div>
    );
  }

  // ============ CONTENT PAGE ============
  if (pageData.source_type === "content") {
    return (
      <div
        className="public-content-view"
        style={{
          padding: "40px 20px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <h1 style={{ color: "#0c2f55" }}>{pageData.title}</h1>

        {pageData.featured_image && (
          <img
            src={pageData.featured_image}
            alt={pageData.title}
            style={{
              width: "100%",
              maxWidth: 600,
              borderRadius: 8,
              marginBottom: 20,
            }}
          />
        )}

        {/* ✅ Direct HTML render — no ContentRenderer needed */}
        <div
          dangerouslySetInnerHTML={{
            __html: pageData.content || "",
          }}
        />
      </div>
    );
  }

  // ============ LATEST POSTS FALLBACK ============
  return <LatestPostsHome device={device} />;
};

// ============ LATEST POSTS HOME ============
const LatestPostsHome = ({ device }: { device: ResponsiveDevice }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/public/posts`, {
          params: { page: 1 },
        });
        setPosts(res.data.posts || []);
      } catch (err) {
        console.error("Posts load error:", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div style={{ padding: "40px 20px", maxWidth: 1200, margin: "0 auto" }}>
      <h1
        style={{
          textAlign: "center",
          marginBottom: 40,
          color: "#0c2f55",
          fontSize: 36,
        }}
      >
        Latest Posts
      </h1>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
          <p style={{ fontSize: 18 }}>No posts published yet.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              device === "mobile"
                ? "1fr"
                : device === "tablet"
                  ? "repeat(2, 1fr)"
                  : "repeat(3, 1fr)",
            gap: 24,
          }}
        >
          {posts.map((post) => {
            const postPath = post.permalink || `/${post.slug}`;
            return (
            <a
              key={post.id}
              href={postPath}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, "", postPath);
                window.dispatchEvent(new PopStateEvent("popstate"));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: "1px solid #e0e6ed",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                display: "block",
                cursor: "pointer",
              }}
            >
              {post.featured_image && (
                <img
                  src={post.featured_image}
                  alt={post.title}
                  style={{
                    width: "100%",
                    height: 200,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}
              <div style={{ padding: 20 }}>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 18,
                    color: "#0c2f55",
                  }}
                >
                  {post.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "#666",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {post.excerpt}
                </p>
              </div>
            </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HomePage;