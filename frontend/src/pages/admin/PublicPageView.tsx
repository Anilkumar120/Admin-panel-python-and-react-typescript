import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL, getImageUrl } from "../../api/config";
import BuilderRenderer from "../../components/ContentRenderer/BuilderRenderer";
import type { ProductData } from "../../components/ContentRenderer/BuilderRenderer";
import ContentRenderer from "../../components/ContentRenderer/ContentRenderer";
import type { ResponsiveDevice } from "../../types/pageBuilder";
import { fetchActiveTemplate } from "../../api/templates";

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

const PublicPageView = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPath, setCurrentPath] = useState(location.pathname);
  const device = useDevice();

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname]);

  const pathParts = currentPath.split("/").filter(Boolean);
  let slug = params.slug;
  let postType = params.postType;
  const postId = new URLSearchParams(location.search).get("p") || undefined;

  if (!slug && pathParts.length > 0) {
    slug = pathParts[pathParts.length - 1];
    if (pathParts.length > 1) {
      postType = pathParts[0];
    }
  }

  useEffect(() => {
    if (!slug && !postId) {
      setError("Invalid URL");
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await axios.get(`${API_URL}/api/public/resolve`, {
          params: { slug, post_type: postType, url_path: currentPath, post_id: postId },
        });

        if (!active) return;

        const data = res.data;

        if (data.type === "builder") {
          setPage({ type: "builder", data });
        } else if (data.post_type === "products") {
          // Backend attached template if matched
          let template = data.template || null;

          // Client fallback
          if (!template) {
            try {
              template = await fetchActiveTemplate(
                "single_product",
                currentPath,
                "products",
                data.slug || slug,
              );
            } catch (templateError) {
              console.error("PUBLIC PRODUCT TEMPLATE LOAD ERROR:", templateError);
            }
          }
          if (!active) return;
          setPage({ type: "product", data, template });
        } else if (data.template) {
          setPage({ type: "content", data, template: data.template });
        } else {
          setPage({ type: "content", data });
        }
      } catch (err: any) {
        if (!active) return;
        console.error("PublicPageView error:", err);
        if (err?.response?.status === 404) {
          setError("Content not found");
        } else {
          setError("Failed to load content");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [slug, postType, currentPath, postId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPath]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        Loading...
      </div>
    );
  }

  if (error || !page) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: "center",
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        <h1 style={{ fontSize: 48, color: "#0c2f55", marginBottom: 8 }}>404</h1>
        <p style={{ color: "#b42318", fontSize: 18 }}>
          {error || "Page not found"}
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            color: "#0c2f55",
            textDecoration: "underline",
            marginTop: 20,
            display: "inline-block",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  // ===== BUILDER PAGE =====
  if (page.type === "builder") {
    const showTitle = page.data.show_title !== false;
    return (
      <div className="public-builder-view">
        {showTitle && page.data.title && (
          <div className="public-page-title">
            <h1>{page.data.title}</h1>
          </div>
        )}
        <BuilderRenderer
          layout={page.data.layout}
          device={device}
          pageId={String(
            page.data.id || page.data.page_id || page.data.slug || currentPath,
          )}
          pageTitle={page.data.title || ""}
        />
      </div>
    );
  }

  // ===== PRODUCT PAGE =====
  if (page.type === "product") {
    const product = page.data as ProductData;

    // ✅ Template first
    if (page.template?.layout?.length) {
      return (
        <div className="public-builder-view">
          <BuilderRenderer
            layout={page.template.layout}
            device={device}
            pageId={product.id}
            pageTitle={product.title}
            product={product}
          />
        </div>
      );
    }

    // Content-based template fallback
    if (page.template?.content) {
      return <ContentRenderer layout={page.template.content} />;
    }

    // Default product layout
    return (
      <article
        className="public-product-view"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 32,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
        {product.image && (
          <img
            src={getImageUrl(product.image)}
            alt={product.title}
            style={{ width: "100%", borderRadius: 10, objectFit: "contain" }}
          />
        )}
        <div>
          <h1>{product.title}</h1>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#0c2f55" }}>
            ₹{Number(product.price || 0).toFixed(2)}
          </p>
          <p>
            {product.quantity > 0
              ? `In stock (${product.quantity})`
              : "Out of stock"}
          </p>
          {product.brand && <p>Brand: {product.brand}</p>}
          {product.category && <p>Category: {product.category}</p>}
          <p>{product.description}</p>
        </div>
      </article>
    );
  }

  // ===== CONTENT PAGE (post/page with template) =====
  if (page.template?.layout?.length) {
    return (
      <div className="public-builder-view">
        <BuilderRenderer
          layout={page.template.layout}
          device={device}
          pageId={String(page.data.id || page.data.slug)}
          pageTitle={page.data.title || ""}
        />
      </div>
    );
  }

  return (
    <div
      className="public-content-view"
      style={{ padding: "40px 20px", maxWidth: 900, margin: "0 auto" }}
    >
      <h1 style={{ color: "#0c2f55" }}>{page.data.title}</h1>

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