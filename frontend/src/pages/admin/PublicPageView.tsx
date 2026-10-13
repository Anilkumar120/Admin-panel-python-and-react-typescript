import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BuilderRenderer from "../../components/ContentRenderer/BuilderRenderer";
import ContentRenderer from "../../components/ContentRenderer/ContentRenderer";
import {
  getPublicBuilderPage,
  getPublicPageBySlug,
  getPublicPostBySlug,
} from "../../api/publicContent";
import type { ResponsiveDevice } from "../../types/pageBuilder";

// ============ DEVICE DETECTION HOOK ============
const useDevice = (): ResponsiveDevice => {
  const [device, setDevice] = useState<ResponsiveDevice>("desktop");

  useEffect(() => {
    const updateDevice = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice("mobile");
      else if (w < 1024) setDevice("tablet");
      else setDevice("desktop");
    };

    updateDevice();
    window.addEventListener("resize", updateDevice);
    return () => window.removeEventListener("resize", updateDevice);
  }, []);

  return device;
};

const PublicPageView = () => {
  const { slug, postType } = useParams();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Detect current device for responsive rendering
  const device = useDevice();

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      setLoading(true);
      setError("");

      try {
        // Try builder page first
        try {
          const builderPage = await getPublicBuilderPage(slug);
          if (builderPage && builderPage.layout?.length) {
            setPage({ type: "builder", data: builderPage });
            return;
          }
        } catch {
          // not a builder page
        }

        // Try regular page
        if (!postType || postType === "pages") {
          try {
            const regularPage = await getPublicPageBySlug(slug);
            setPage({ type: "content", data: regularPage });
            return;
          } catch {
            // not a page
          }
        }

        // Try post
        if (postType === "posts") {
          try {
            const post = await getPublicPostBySlug(slug);
            setPage({ type: "content", data: post });
            return;
          } catch {
            // not a post
          }
        }

        setError("Content not found");
      } catch (err) {
        console.error(err);
        setError("Content not found");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug, postType]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;
  }

  if (error || !page) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#b42318" }}>
        {error || "Not found"}
      </div>
    );
  }

  // ✅ Builder page — hide title if show_title is false
  if (page.type === "builder") {
    const showTitle = page.data.show_title !== false;

    return (
      <div className="public-builder-view">
        {showTitle && (
          <div className="public-page-title">
            <h1>{page.data.title}</h1>
          </div>
        )}
        {/* ✅ Pass detected device so responsive overrides apply */}
        <BuilderRenderer layout={page.data.layout} device={device} />
      </div>
    );
  }

  // ✅ Content page
  return (
    <div
      className="public-content-view"
      style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}
    >
      <h1>{page.data.title}</h1>
      {page.data.featured_image && (
        <img
          src={page.data.featured_image}
          alt={page.data.title}
          style={{
            width: "100%",
            maxWidth: 600,
            borderRadius: 8,
            marginBottom: 20,
          }}
        />
      )}
      <ContentRenderer layout={page.data.content} />
    </div>
  );
};

export default PublicPageView;