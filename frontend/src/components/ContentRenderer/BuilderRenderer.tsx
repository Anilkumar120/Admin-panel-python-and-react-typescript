import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type ElementType,
  type FormEvent,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import * as FaIcons from "react-icons/fa";
import { API_URL, getImageUrl } from "../../api/config";
import type { PageWidget, ResponsiveDevice } from "../../types/pageBuilder";
import { submitForm } from "../../api/forms";
import { addToCart } from "../../api/cart";
import { getPublicMenu } from "../../api/menus";
import BuilderIcon from "../BuilderIcon";
import { loadGoogleFont } from "../../utils/googleFonts";

const SOCIAL_ICON_ALIASES: Record<string, string> = {
  facebook: "FaFacebookF",
  instagram: "FaInstagram",
  twitter: "FaTwitter",
  x: "FaTwitter",
  youtube: "FaYoutube",
  linkedin: "FaLinkedinIn",
  whatsapp: "FaWhatsapp",
  pinterest: "FaPinterestP",
  tiktok: "FaTiktok",
  telegram: "FaTelegramPlane",
  github: "FaGithub",
  discord: "FaDiscord",
  snapchat: "FaSnapchatGhost",
  reddit: "FaRedditAlien",
  tumblr: "FaTumblr",
  vimeo: "FaVimeoV",
  dribbble: "FaDribbble",
  behance: "FaBehance",
  skype: "FaSkype",
  email: "FaEnvelope",
  phone: "FaPhone",
  website: "FaGlobe",
};

const SocialIconGlyph = ({ name, size = 20 }: { name?: string; size?: number }) => {
  const iconName = SOCIAL_ICON_ALIASES[(name || "").toLowerCase()] || name || "";
  const IconComponent = (FaIcons as any)[iconName];
  if (IconComponent) return <IconComponent size={size} aria-hidden="true" />;
  return <span aria-hidden="true">{(name || "•").slice(0, 2)}</span>;
};

const StorefrontWidget = lazy(
  () => import("../../pages/Storefront/Storefront"),
);

interface BuilderRendererProps {
  layout: PageWidget[];
  device?: ResponsiveDevice;
  pageId?: string;
  pageTitle?: string;
  product?: ProductData;
}

export interface ProductData {
  id: string;
  title: string;
  name: string;
  slug: string;
  permalink?: string;
  description: string;
  short_description?: string;
  excerpt: string;
  image: string;
  featured_image: string;
  gallery?: { media_id?: string; url: string; alt?: string }[];
  price: number;
  regular_price?: number;
  sale_price?: number | null;
  quantity: number;
  manage_stock?: boolean;
  stock_status: string;
  category: string;
  categories?: string[];
  tags?: string[];
  brand: string;
  sku: string;
  barcode?: string;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  attributes?: { name: string; options: string[] }[];
  variations?: {
    sku?: string;
    price?: number;
    quantity?: number;
    attributes?: Record<string, string>;
  }[];
}

const safeList = <T,>(value: T[] | undefined | null): T[] => value ?? [];

// ============ PRODUCT GRID ============
const ProductGridWidget = ({
  limit,
  columns,
  query = "all",
  productId,
}: {
  limit: number;
  columns: number;
  query?: "all" | "related" | "recent";
  productId?: string;
}) => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let url = `${API_URL}/api/public/products`;
    const params: Record<string, unknown> = { limit };

    if (query === "related" && productId) {
      url = `${API_URL}/api/public/products/${productId}/related`;
    } else if (query === "recent") {
      params.sort = "recent";
    }

    axios
      .get<{ products: ProductData[] }>(url, { params })
      .then(({ data }) => {
        if (active)
          setProducts(Array.isArray(data.products) ? data.products : []);
      })
      .catch((loadError) => {
        console.error("PUBLIC PRODUCT GRID LOAD ERROR:", loadError);
        if (active) setError("Products could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [limit, query, productId]);

  if (error) return <p role="alert">{error}</p>;
  if (!products.length) return <p>No products available.</p>;

  const cardMinWidth = Math.max(
    160,
    Math.floor(1200 / Math.max(1, Math.min(columns, 6))),
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${cardMinWidth}px), 1fr))`,
        gap: 16,
      }}
    >
      {products.map((product) => (
        <a
          key={product.id}
          href={
            product.permalink ||
            `/${encodeURIComponent(product.slug || product.id)}`
          }
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            overflow: "hidden",
            color: "inherit",
            textAlign: "center",
            textDecoration: "none",
            background: "#fff",
          }}
        >
          {product.image && (
            <img
              src={getImageUrl(product.image)}
              alt={product.title}
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                aspectRatio: "1",
                objectFit: "cover",
              }}
            />
          )}
          <div style={{ padding: 12 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>{product.title}</h3>
            <ProductPrice product={product} />
          </div>
        </a>
      ))}
    </div>
  );
};

const ProductPrice = ({ product }: { product: ProductData }) => {
  const regularPrice = Number(product.regular_price || 0);
  const currentPrice = Number(product.price || 0);
  const onSale = regularPrice > 0 && currentPrice < regularPrice;
  const discount = onSale
    ? Math.round(((regularPrice - currentPrice) / regularPrice) * 100)
    : 0;

  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      {onSale && (
        <del style={{ color: "#6b7280", fontSize: "0.9em", fontWeight: 400 }}>
          ₹{regularPrice.toFixed(2)}
        </del>
      )}
      <strong style={{ color: "#0c2f55" }}>
        ₹{currentPrice.toFixed(2)}
      </strong>
      {onSale && (
        <small style={{ color: "#b42318", fontWeight: 600 }}>
          {discount}% off
        </small>
      )}
    </span>
  );
};

const PublicTestimonialCarousel = ({
  items,
  settings,
  color,
  background,
}: {
  items: NonNullable<PageWidget["items"]>;
  settings: PageWidget["settings"];
  color: string;
  background?: string;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  if (!items.length) return null;
  const index = activeIndex % items.length;
  const item = items[index];

  return (
    <div
      style={{
        padding: 32,
        borderRadius: settings?.testimonialSkin === "bubble" ? 24 : 12,
        background: background || "#f8f9fc",
        textAlign: settings?.testimonialAlignment || "center",
      }}
    >
      {item.image && (
        <img
          src={getImageUrl(item.image)}
          alt={item.title || "Testimonial author"}
          loading="lazy"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
            margin:
              settings?.testimonialLayout === "image-above"
                ? "0 auto 16px"
                : "0 0 16px",
          }}
        />
      )}
      <div aria-label={`${settings?.rating || 5} out of 5 stars`} style={{ color: "#f0b429" }}>
        {"★".repeat(Math.max(1, Math.min(5, Number(settings?.rating || 5))))}
      </div>
      <blockquote style={{ margin: "12px 0 16px", color: "#444", fontStyle: "italic" }}>
        “{item.content || ""}”
      </blockquote>
      <strong style={{ color }}>{item.title}</strong>
      {item.label && <div style={{ marginTop: 4, color: "#667085", fontSize: 13 }}>{item.label}</div>}
      {items.length > 1 && (
        <div
          className="testimonial-preview-controls"
          style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}
        >
          <button type="button" aria-label="Previous testimonial" onClick={() => setActiveIndex((value) => (value - 1 + items.length) % items.length)}>‹</button>
          <span>{index + 1} / {items.length}</span>
          <button type="button" aria-label="Next testimonial" onClick={() => setActiveIndex((value) => (value + 1) % items.length)}>›</button>
        </div>
      )}
    </div>
  );
};

const AnimatedCounter = ({
  start,
  end,
  duration,
  separator,
  showSeparator,
}: {
  start: number;
  end: number;
  duration: number;
  separator: string;
  showSeparator: boolean;
}) => {
  const [value, setValue] = useState(start);
  useEffect(() => {
    if (duration <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(end);
      return;
    }
    let frame = 0;
    let startTime = 0;
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      setValue(Math.round(start + (end - start) * progress));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [start, end, duration]);

  const formatted = showSeparator
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
        .format(value)
        .replace(/,/g, separator)
    : String(value);
  return <>{formatted}</>;
};

const PublicPostsWidget = ({
  limit,
  columns,
  layout,
  source = "posts",
  postType = "posts",
  categories = [],
  tags = [],
  exclude = false,
  orderBy = "date",
  order = "DESC",
  dateRange = "all",
  pagination = "none",
}: {
  limit: number;
  columns: number;
  layout: "grid" | "list" | "carousel";
  source?: "posts" | "custom";
  postType?: string;
  categories?: string[];
  tags?: string[];
  exclude?: boolean;
  orderBy?: "date" | "title";
  order?: "ASC" | "DESC";
  dateRange?: "all" | "day" | "week" | "month" | "year";
  pagination?: "none" | "numbers" | "load_more";
}) => {
  const [posts, setPosts] = useState<
    {
      id: string;
      title: string;
      slug: string;
      permalink?: string;
      excerpt?: string;
      featured_image?: string;
    }[]
  >([]);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let active = true;
    const url = source === "custom"
      ? `${API_URL}/api/public/items/${encodeURIComponent(postType)}`
      : `${API_URL}/api/public/posts`;
    axios
      .get<{ posts?: typeof posts; items?: typeof posts; pages?: number }>(url, {
        params: {
          page: currentPage,
          limit,
          category: categories.join(",") || undefined,
          tag: tags.join(",") || undefined,
          exclude,
          order_by: orderBy,
          order,
          date_range: dateRange,
        },
      })
      .then(({ data }) => {
        if (active) {
          const nextItems = data.posts || data.items || [];
          setPosts((current) =>
            pagination === "load_more" && currentPage > 1
              ? [...current, ...nextItems]
              : nextItems,
          );
          setTotalPages(data.pages || 1);
          setError("");
        }
      })
      .catch((loadError) => {
        console.error("PUBLIC POST WIDGET LOAD ERROR:", loadError);
        if (active) setError("Posts could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [limit, source, postType, categories.join(","), tags.join(","), exclude, orderBy, order, dateRange, currentPage, pagination]);

  if (error) return <p role="alert">{error}</p>;
  if (!posts.length) return <p>No items matched this loop query.</p>;

  return (
    <div>
      <div
        style={{
          display: layout === "carousel" ? "flex" : "grid",
          gridTemplateColumns: layout === "grid"
            ? `repeat(auto-fit, minmax(min(100%, ${Math.max(180, Math.floor(1200 / Math.max(1, columns)))}px), 1fr))`
            : "1fr",
          gap: 20,
          overflowX: layout === "carousel" ? "auto" : undefined,
          scrollSnapType: layout === "carousel" ? "x mandatory" : undefined,
        }}
      >
      {posts.map((post) => (
        <a
          key={post.id}
          href={post.permalink || `/${post.slug}`}
          style={{
            display: layout === "list" ? "flex" : "block",
            gap: 16,
            flex: layout === "carousel" ? "0 0 min(82vw, 360px)" : undefined,
            scrollSnapAlign: layout === "carousel" ? "start" : undefined,
            border: "1px solid #e0e6ed",
            borderRadius: 8,
            overflow: "hidden",
            color: "inherit",
            textDecoration: "none",
            background: "#fff",
          }}
        >
          {post.featured_image && (
            <img
              src={getImageUrl(post.featured_image)}
              alt={post.title}
              loading="lazy"
              style={{
                width: layout === "list" ? 180 : "100%",
                height: layout === "list" ? 130 : 190,
                objectFit: "cover",
              }}
            />
          )}
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: "0 0 8px" }}>{post.title}</h3>
            {post.excerpt && <p style={{ margin: 0 }}>{post.excerpt}</p>}
          </div>
        </a>
      ))}
      </div>
      {pagination === "numbers" && totalPages > 1 && (
        <nav aria-label="Loop pagination" style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>Previous</button>
          <span>{currentPage} / {totalPages}</span>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Next</button>
        </nav>
      )}
      {pagination === "load_more" && currentPage < totalPages && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button type="button" onClick={() => setCurrentPage((page) => page + 1)}>Load more</button>
        </div>
      )}
    </div>
  );
};

function ProductLoopWidget({
  widget,
  device,
  pageId,
  pageTitle,
}: {
  widget: PageWidget;
  device: ResponsiveDevice;
  pageId: string;
  pageTitle: string;
}) {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const settings = widget.settings || {};
  const limit = settings.postsPerPage || 6;
  const categories = settings.loopCategories || [];
  const tags = settings.loopTags || [];
  const order = settings.loopOrder || "DESC";
  const pagination = settings.loopPagination || "none";
  const columns = Math.max(1, Math.min(6, settings.columns || 3));
  const isCarousel = widget.type === "loop_carousel";

  useEffect(() => {
    let active = true;
    const sort = settings.loopOrderBy === "price"
      ? order === "ASC" ? "price_low" : "price_high"
      : settings.loopOrderBy === "title"
        ? "title"
        : "recent";
    axios
      .get<{ products?: ProductData[]; pages?: number }>(
        `${API_URL}/api/public/products`,
        {
          params: {
            page: currentPage,
            limit,
            category: categories.join(",") || undefined,
            tag: tags.join(",") || undefined,
            exclude: settings.includeExclude === "exclude",
            sort,
            order,
          },
        },
      )
      .then(({ data }) => {
        if (!active) return;
        const nextProducts = Array.isArray(data.products) ? data.products : [];
        setProducts((current) =>
          pagination === "load_more" && currentPage > 1
            ? [...current, ...nextProducts]
            : nextProducts,
        );
        setTotalPages(data.pages || 1);
        setError("");
      })
      .catch((loadError) => {
        console.error("PUBLIC PRODUCT LOOP LOAD ERROR:", loadError);
        if (active) setError("Products could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [
    limit,
    currentPage,
    categories.join(","),
    tags.join(","),
    order,
    settings.loopOrderBy,
    settings.includeExclude,
    pagination,
  ]);

  if (error) return <p role="alert">{error}</p>;
  if (!products.length) return <p>No products matched this loop query.</p>;

  return (
    <div>
      <div
        style={{
          display: isCarousel ? "flex" : "grid",
          gridTemplateColumns: isCarousel
            ? undefined
            : `repeat(${columns}, minmax(0, 1fr))`,
          gap: 20,
          overflowX: isCarousel ? "auto" : undefined,
          scrollSnapType: isCarousel ? "x mandatory" : undefined,
        }}
      >
        {products.map((product) => (
          <article
            key={product.id}
            style={{
              display: "grid",
              alignContent: "start",
              gap: 8,
              minWidth: isCarousel ? "min(82vw, 360px)" : 0,
              scrollSnapAlign: isCarousel ? "start" : undefined,
              overflow: "hidden",
              border: "1px solid #e0e6ed",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            {widget.children?.length ? (
              widget.children.map((child) => (
                <WidgetRenderer
                  key={`${product.id}-${child.id}`}
                  widget={child}
                  device={device}
                  pageId={pageId}
                  pageTitle={pageTitle}
                  product={product}
                />
              ))
            ) : (
              <>
                {product.image && (
                  <img
                    src={getImageUrl(product.image)}
                    alt={product.title}
                    loading="lazy"
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }}
                  />
                )}
                <div style={{ padding: 12 }}>
                  <h3 style={{ margin: "0 0 8px" }}>{product.title}</h3>
                  <ProductPrice product={product} />
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      {pagination === "numbers" && totalPages > 1 && (
        <nav aria-label="Product loop pagination" style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>Previous</button>
          <span>{currentPage} / {totalPages}</span>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Next</button>
        </nav>
      )}
      {pagination === "load_more" && currentPage < totalPages && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button type="button" onClick={() => setCurrentPage((page) => page + 1)}>Load more</button>
        </div>
      )}
    </div>
  );
}

// ============ STYLE INJECTOR ============
const StyleInjector = ({ css }: { css: string }) => {
  if (!css) return null;
  return (
    <style
      dangerouslySetInnerHTML={{ __html: css }}
      data-builder-style="true"
    />
  );
};

// ============ TABS ============
const InteractiveTabs = ({
  items,
  widgetId,
  color,
  renderChildren,
}: {
  items: NonNullable<PageWidget["items"]>;
  widgetId: string;
  color: string;
  renderChildren: (children: PageWidget[]) => React.ReactNode;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items[activeIndex] || items[0];
  if (!activeItem) return null;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Content tabs"
        style={{
          display: "flex",
          flexWrap: "wrap",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            id={`${widgetId}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-controls={`${widgetId}-panel`}
            onClick={() => setActiveIndex(index)}
            style={{
              padding: "10px 20px",
              border: 0,
              borderBottom:
                index === activeIndex
                  ? `2px solid ${color}`
                  : "2px solid transparent",
              background: "transparent",
              color: index === activeIndex ? color : "#666",
              fontWeight: index === activeIndex ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div
        id={`${widgetId}-panel`}
        role="tabpanel"
        aria-labelledby={`${widgetId}-tab-${activeIndex}`}
        style={{ padding: 12, color: "#666" }}
      >
        {activeItem.image && <img src={activeItem.image} alt={activeItem.title || "Tab image"} style={{ display: "block", width: "100%", maxWidth: "100%", height: "auto", objectFit: "cover", marginBottom: 12, borderRadius: 6 }} />}
        {activeItem.content}
        {activeItem.children?.length ? renderChildren(activeItem.children) : null}
      </div>
    </div>
  );
};

// ============ PUBLIC FORM ============
const PublicFormWidget = ({
  widget,
  pageId,
  pageTitle,
  background,
}: {
  widget: PageWidget;
  pageId: string;
  pageTitle: string;
  background?: string;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const website = String(formData.get("website") || "");
    const fields = Object.fromEntries(
      Array.from(formData.entries())
        .filter(
          ([name, value]) => name !== "website" && typeof value === "string",
        )
        .map(([name, value]) => [name, String(value)]),
    );

    try {
      await submitForm({
        page_id: pageId,
        page_title: pageTitle,
        widget_id: widget.id,
        fields,
        website,
      });
      setMessage(
        widget.settings?.successMessage ||
          "Thank you. Your message has been received.",
      );
      form.reset();
    } catch (submitError) {
      console.error("PUBLIC FORM SUBMISSION ERROR:", submitError);
      setError("Your message could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      style={{
        padding: 24,
        background: background || "#f8f9fc",
        borderRadius: 12,
      }}
    >
      {(widget.settings?.formFields || [
        { id: "name", title: "Name", fieldType: "text", required: true },
        { id: "email", title: "Email", fieldType: "email", required: true },
        { id: "message", title: "Message", fieldType: "textarea", required: true },
      ]).map((field) => (
        <label key={field.id} style={{ display: "block", marginBottom: 12 }}>
          <span>{field.title}</span>
          {field.fieldType === "textarea" ? (
            <textarea
              name={field.id}
              placeholder={field.placeholder || ""}
              required={field.required !== false}
              maxLength={5000}
              rows={4}
              style={{ width: "100%", padding: 12, marginTop: 4, border: "1px solid #ddd", borderRadius: 6, boxSizing: "border-box" }}
            />
          ) : field.fieldType === "select" ? (
            <select
              name={field.id}
              required={field.required !== false}
              style={{ width: "100%", padding: 12, marginTop: 4, border: "1px solid #ddd", borderRadius: 6, boxSizing: "border-box" }}
            >
              <option value="">{field.placeholder || "Select an option"}</option>
              {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : field.fieldType === "checkbox" ? (
            <input name={field.id} type="checkbox" required={field.required === true} />
          ) : (
            <input
              name={field.id}
              type={field.fieldType || "text"}
              placeholder={field.placeholder || ""}
              required={field.required !== false}
              maxLength={field.fieldType === "email" ? 320 : 200}
              style={{ width: "100%", padding: 12, marginTop: 4, border: "1px solid #ddd", borderRadius: 6, boxSizing: "border-box" }}
            />
          )}
        </label>
      ))}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
        }}
      />
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "12px 24px",
          background: "#0c2f55",
          color: "#fff",
          border: 0,
          borderRadius: 6,
          fontWeight: 600,
          cursor: submitting ? "wait" : "pointer",
        }}
      >
        {submitting ? "Sending..." : widget.settings?.submitText || "Submit"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}
    </form>
  );
};

// ============ HOVER + ANIMATION ============
const getHoverAndAnimation = (style: any, widgetId: string) => {
  const hasHoverBorderRadius =
    style?.hoverBorderRadius != null &&
    Number.isFinite(Number(style.hoverBorderRadius));
  const hasHoverOpacity =
    style?.hoverOpacity != null &&
    Number.isFinite(Number(style.hoverOpacity)) &&
    Number(style.hoverOpacity) !== 1;
  const hasHover =
    style?.hoverBackgroundColor ||
    style?.hoverColor ||
    style?.hoverBorderColor ||
    hasHoverBorderRadius ||
    style?.hoverBackgroundGradient ||
    style?.hoverOverlayGradient ||
    style?.hoverOverlayColor ||
    style?.hoverOverlayImage ||
    style?.hoverCssFilters ||
    style?.hoverBoxShadow ||
    (style?.hoverScale && style.hoverScale !== 1) ||
    hasHoverOpacity ||
    style?.hoverTranslateY;

  const hasAnimation = style?.animation && style.animation !== "none";
  const hasCustomCss = Boolean(String(style?.customCss || "").trim());
  const hasVisualEffects = (style?.backgroundType === "video" && style?.backgroundVideo) || (style?.backgroundType === "slideshow" && Array.isArray(style?.backgroundSlideshow) && style.backgroundSlideshow.length) || ["top", "bottom"].some((side) => style?.[`shapeDivider${side}Type`] && style[`shapeDivider${side}Type`] !== "none");

  if (!hasHover && !hasAnimation && !hasCustomCss && !hasVisualEffects) {
    return { className: "", cssText: "" };
  }

  const uid = `w-${widgetId.replace(/[^a-z0-9]/gi, "")}`;
  const cssParts: string[] = [];
  const classes: string[] = [];

  if (hasHover) {
    const hoverClass = `${uid}-hover`;
    classes.push(hoverClass);

    const duration = style.transitionDuration || 300;
    const hoverRules: string[] = [];
    const hoverBackgroundLayers: string[] = [];
    if (style.hoverBackgroundColor)
      hoverRules.push(`background-color: ${style.hoverBackgroundColor} !important;`);
    if (style.hoverOverlayColor)
      hoverBackgroundLayers.push(`linear-gradient(color-mix(in srgb, ${style.hoverOverlayColor} ${(Number(style.overlayOpacity ?? 0.35) * 100)}%, transparent), color-mix(in srgb, ${style.hoverOverlayColor} ${(Number(style.overlayOpacity ?? 0.35) * 100)}%, transparent))`);
    if (style.hoverOverlayGradient)
      hoverBackgroundLayers.push(style.hoverOverlayGradient);
    if (style.hoverOverlayImage)
      hoverBackgroundLayers.push(`url("${getImageUrl(String(style.hoverOverlayImage))}")`);
    if (style.hoverBackgroundGradient)
      hoverBackgroundLayers.push(style.hoverBackgroundGradient);
    if (hoverBackgroundLayers.length)
      hoverRules.push(`background-image: ${hoverBackgroundLayers.join(", ")} !important;`);
    if (style.hoverColor)
      hoverRules.push(`color: ${style.hoverColor} !important;`);
    if (style.hoverBorderColor)
      hoverRules.push(`border-color: ${style.hoverBorderColor} !important;`);
    if (hasHoverBorderRadius)
      hoverRules.push(`border-radius: ${style.hoverBorderRadius}px !important;`);
    if (style.hoverCssFilters)
      hoverRules.push(`filter: ${style.hoverCssFilters} !important;`);
    if (style.hoverBoxShadow)
      hoverRules.push(`box-shadow: ${style.hoverBoxShadow} !important;`);

    const transforms: string[] = [];
    if (style.hoverScale && style.hoverScale !== 1)
      transforms.push(`scale(${style.hoverScale})`);
    if (style.hoverTranslateY)
      transforms.push(`translateY(${style.hoverTranslateY}px)`);
    if (style.hoverRotate) transforms.push(`rotate(${style.hoverRotate}deg)`);
    if (transforms.length)
      hoverRules.push(`transform: ${transforms.join(" ")} !important;`);

    if (hasHoverOpacity)
      hoverRules.push(`opacity: ${style.hoverOpacity} !important;`);

    cssParts.push(`
      .${hoverClass} {
        transition: all ${duration}ms ease-in-out;
      }
      .${hoverClass}:hover {
        ${hoverRules.join("\n")}
      }
    `);
  }

  if (hasAnimation) {
    const animClass = `${uid}-anim`;
    classes.push(animClass);

    const duration = style.animationDuration || 600;
    const delay = style.animationDelay || 0;
    const easing = style.animationEasing || "ease";

    const keyframesMap: Record<string, string> = {
      fadeIn: `from { opacity: 0; } to { opacity: 1; }`,
      slideUp: `from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); }`,
      slideDown: `from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); }`,
      slideLeft: `from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); }`,
      slideRight: `from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); }`,
      zoomIn: `from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); }`,
      bounce: `0%,20%,50%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-15px); } 60% { transform: translateY(-8px); }`,
      pulse: `0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); }`,
    };

    const kfName = `${uid}-kf`;
    const kfBody = keyframesMap[style.animation] || keyframesMap.fadeIn;

    cssParts.push(`
      @keyframes ${kfName} { ${kfBody} }
      .${animClass} {
        animation: ${kfName} ${duration}ms ${easing} ${delay}ms both;
      }
    `);
  }

  if (style?.backgroundType === "slideshow" && Array.isArray(style?.backgroundSlideshow) && style.backgroundSlideshow.length) {
    const images: string[] = style.backgroundSlideshow.filter((url: unknown) => typeof url === "string" && url.trim()).map((url: string) => `url("${url}")`);
    if (images.length) {
      const slideClass = `${uid}-slideshow`;
      classes.push(slideClass);
      const frames = images.map((bg, i) => `${(i / images.length) * 100}% { background-image: ${bg}; }`).join(" ");
      cssParts.push(`@keyframes ${uid}-slides { ${frames} 100% { background-image: ${images[0]}; } } .${slideClass} { animation: ${uid}-slides ${Math.max(3, images.length * 3)}s infinite; background-size: cover; background-position: center; }`);
    }
  }
  const shapeSides = ["top", "bottom"].filter((side) => style?.[`shapeDivider${side}Type`] && style[`shapeDivider${side}Type`] !== "none");
  if (shapeSides.length) {
    const shapeClass = `${uid}-shape-divider`;
    classes.push(shapeClass);
    const shapeRules = shapeSides.map((side) => {
      const type = style[`shapeDivider${side}Type`];
      const height = Math.max(0, Number(style[`shapeDivider${side}Height`] ?? 50));
      const color = style[`shapeDivider${side}Color`] || "#ffffff";
      const clip = type === "triangle" ? (side === "top" ? "polygon(0 0, 100% 0, 50% 100%)" : "polygon(0 100%, 100% 100%, 50% 0)") : type === "tilt" ? (side === "top" ? "polygon(0 0, 100% 0, 100% 35%, 0 100%)" : "polygon(0 65%, 100% 0, 100% 100%, 0 100%)") : type === "curve" ? "ellipse(75% 100% at 50% 0%)" : type === "wave" ? (side === "top" ? "polygon(0 0, 100% 0, 100% 65%, 75% 100%, 50% 65%, 25% 100%, 0 65%)" : "polygon(0 35%, 25% 0, 50% 35%, 75% 0, 100% 35%, 100% 100%, 0 100%)") : "none";
      return `.${shapeClass}::${side === "top" ? "before" : "after"} { content: ""; position: absolute; left: 0; right: 0; ${side}: 0; width: 100%; height: ${height}px; background: ${color}; clip-path: ${clip}; pointer-events: none; z-index: 2; }`;
    }).join("\n");
    cssParts.push(`.${shapeClass} { position: relative; } ${shapeRules}`);
  }
  if (style?.backgroundType === "video" && style?.backgroundVideo) {
    const videoClass = `${uid}-video-bg`;
    classes.push(videoClass);
    cssParts.push(`.${videoClass} > *:not(video) { position: relative; z-index: 1; }`);
  }
  const customCss = String(style?.customCss || "").trim();
  const customClass = `${uid}-custom`;
  if (customCss) {
    classes.push(customClass);
    const scopedCss = customCss.replace(/selector/g, `.${customClass}`);
    cssParts.push(scopedCss.includes(`.${customClass}`) ? scopedCss : `.${customClass} { ${scopedCss} }`);
  }

  return {
    className: classes.join(" "),
    cssText: cssParts.join("\n"),
  };
};

// ============ PRODUCT GALLERY ============
const ProductGalleryWidget = ({ product }: { product?: ProductData }) => {
  const images = product
    ? [
        ...(product.image ? [{ url: product.image, alt: product.title }] : []),
        ...safeList(product.gallery),
      ].filter(
        (image, index, all) =>
          all.findIndex((candidate) => candidate.url === image.url) === index,
      )
    : [];
  const [selectedImage, setSelectedImage] = useState("");

  useEffect(() => {
    setSelectedImage(images[0]?.url || "");
  }, [product?.id, product?.image, product?.gallery]);

  if (!product)
    return (
      <div>Product Gallery preview — select a product in the builder.</div>
    );
  if (!images.length) return <div>Product has no gallery images.</div>;

  return (
    <div className="product-gallery-widget">
      <img
        src={getImageUrl(selectedImage)}
        alt={
          images.find((image) => image.url === selectedImage)?.alt ||
          product.title
        }
        style={{
          display: "block",
          width: "100%",
          maxHeight: 640,
          objectFit: "contain",
        }}
      />
      {images.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            marginTop: 10,
          }}
        >
          {images.map((image, index) => (
            <button
              key={image.media_id || `${image.url}-${index}`}
              type="button"
              aria-label={`Show product image ${index + 1}`}
              aria-pressed={selectedImage === image.url}
              onClick={() => setSelectedImage(image.url)}
              style={{
                flex: "0 0 72px",
                padding: 2,
                border:
                  selectedImage === image.url
                    ? "2px solid #2563eb"
                    : "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
            >
              <img
                src={getImageUrl(image.url)}
                alt={image.alt || ""}
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "1",
                  objectFit: "cover",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ ADD TO CART ============
const ProductAddToCart = ({
  product,
  style,
}: {
  product?: ProductData;
  style?: React.CSSProperties;
}) => {
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const available = Boolean(
    product &&
    product.stock_status !== "out_of_stock" &&
    (!product.manage_stock || product.quantity > 0),
  );

  return (
    <div>
      {available && (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginRight: 10,
          }}
        >
          <span>Qty</span>
          <input
            type="number"
            min={1}
            max={product?.quantity}
            value={quantity}
            onChange={(event) =>
              setQuantity(
                Math.min(
                  product?.quantity || 1,
                  Math.max(1, Number(event.target.value) || 1),
                ),
              )
            }
            style={{ width: 64, padding: 8 }}
          />
        </label>
      )}
      <button
        type="button"
        disabled={!available}
        onClick={() => {
          if (!product) return;
          try {
            addToCart(
              {
                product_id: product.id,
                name: product.title,
                slug: product.slug,
                price: product.price,
                image: product.image,
              },
              quantity,
            );
            setMessage("Added to cart.");
          } catch (error) {
            console.error("Unable to add product to cart:", error);
            setMessage("Could not add this product to cart.");
          }
        }}
        style={{
          backgroundColor: style?.backgroundColor ?? "#0c2f55",
          color: style?.color ?? "#ffffff",
          border: style?.border ?? 0,
          borderRadius: style?.borderRadius ?? 6,
          borderWidth: style?.borderWidth,
          borderStyle: style?.borderStyle,
          borderColor: style?.borderColor,
          padding: style?.padding ?? "10px 18px",
          cursor: available ? "pointer" : "not-allowed",
        }}
      >
        {available ? "Add to Cart" : "Out of stock"}
      </button>
      {message && (
        <span role="status" style={{ marginLeft: 10 }}>
          {message}
        </span>
      )}
    </div>
  );
};

// ============ PRODUCT QUANTITY ============
const ProductQuantityWidget = ({ product }: { product?: ProductData }) => {
  const [qty, setQty] = useState(1);
  if (!product) return <div>Quantity</div>;
  const max = product.manage_stock ? product.quantity : undefined;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={() => setQty((q) => Math.max(1, q - 1))}
        style={{ width: 32, height: 32, cursor: "pointer" }}
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={max}
        value={qty}
        onChange={(e) =>
          setQty(
            Math.max(1, Math.min(max ?? 9999, Number(e.target.value) || 1)),
          )
        }
        style={{ width: 64, padding: 8, textAlign: "center" }}
      />
      <button
        type="button"
        onClick={() => setQty((q) => Math.min(max ?? 9999, q + 1))}
        style={{ width: 32, height: 32, cursor: "pointer" }}
      >
        +
      </button>
    </div>
  );
};

// ============ PRODUCT ATTRIBUTES ============
const ProductAttributesWidget = ({ product }: { product?: ProductData }) => {
  if (!product?.attributes?.length)
    return <div style={{ color: "#888" }}>No attributes</div>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <tbody>
        {product.attributes.map(
          (attr: { name: string; options: string[] }, i: number) => (
            <tr key={i}>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  background: "#f8f9fc",
                  border: "1px solid #e5e7eb",
                  width: "30%",
                }}
              >
                {attr.name}
              </th>
              <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                {safeList(attr.options).join(", ")}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
};

// ============ PRODUCT VARIATIONS ============
const ProductVariationsWidget = ({ product }: { product?: ProductData }) => {
  if (!product?.variations?.length)
    return <div style={{ color: "#888" }}>No variations</div>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ background: "#f8f9fc" }}>
          <th
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              textAlign: "left",
            }}
          >
            SKU
          </th>
          <th
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              textAlign: "left",
            }}
          >
            Attributes
          </th>
          <th
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              textAlign: "left",
            }}
          >
            Price
          </th>
          <th
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              textAlign: "left",
            }}
          >
            Stock
          </th>
        </tr>
      </thead>
      <tbody>
        {product.variations.map(
          (
            v: {
              sku?: string;
              attributes?: Record<string, string>;
              price?: number;
              quantity?: number;
            },
            i: number,
          ) => (
            <tr key={i}>
              <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                {v.sku || "—"}
              </td>
              <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                {v.attributes
                  ? Object.entries(v.attributes)
                      .map(([k, val]) => `${k}: ${val}`)
                      .join(", ")
                  : "—"}
              </td>
              <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                ₹{v.price ?? 0}
              </td>
              <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                {v.quantity ?? 0}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
};

// ============ STYLE RENDERER ============
const renderStyles = (
  style: any,
  device: ResponsiveDevice,
): React.CSSProperties => {
  const base = style ?? {};
  const responsive = base.responsive?.[device] ?? {};

  const value = (key: string): any =>
    responsive[key] ?? base[key];

  const normalizeSize = (input: unknown): string | undefined => {
    if (input === undefined || input === null || input === "") {
      return undefined;
    }

    // DimensionValue: { value: 120, unit: "px" } or { value: "auto", unit: "auto" }
    if (typeof input === "object" && input !== null && "value" in input) {
      const dimension = input as { value?: number | string; unit?: string };
      if (dimension.value === undefined || dimension.value === null) {
        return undefined;
      }
      if (dimension.value === "auto" || dimension.unit === "auto") {
        return "auto";
      }
      const unit = dimension.unit || "px";
      return `${dimension.value}${unit}`;
    }

    if (typeof input === "number") {
      return `${input}px`;
    }

    const text = String(input).trim();
    if (!text) return undefined;

    return /^-?\d*\.?\d+$/.test(text) ? `${text}px` : text;
  };

  const normalizeSpacing = (input: unknown): string | undefined => {
    if (input === undefined || input === null || input === "") {
      return undefined;
    }

    if (typeof input === "number" || typeof input === "string") {
      return normalizeSize(input);
    }

    if (typeof input !== "object") {
      return undefined;
    }

    const spacing = input as {
      top?: number | string;
      right?: number | string;
      bottom?: number | string;
      left?: number | string;
      unit?: string;
    };
    const unit = spacing.unit || "px";
    const side = (part: number | string | undefined) => {
      if (part === undefined || part === null || part === "") return `0${unit}`;
      if (typeof part === "string" && !/^-?\d*\.?\d+$/.test(part.trim())) {
        return part.trim();
      }
      return `${part}${unit}`;
    };

    return [
      side(spacing.top),
      side(spacing.right),
      side(spacing.bottom),
      side(spacing.left),
    ].join(" ");
  };

  const display = value("display");
  const flexDirection = value("flexDirection");
  const isFlexOrGrid = display === "flex" || display === "grid";
  const gap = normalizeSize(value("gap"));
  const rowGap = normalizeSize(
    responsive.rowGap ?? responsive.gridRowGap ?? base.rowGap ?? base.gridRowGap,
  );
  const columnGap = normalizeSize(
    responsive.columnGap ??
      responsive.gridColumnGap ??
      base.columnGap ??
      base.gridColumnGap,
  );

  const backgroundImage = value("backgroundImage");
  const overlayImage = value("overlayImage");
  const backgroundGradient = value("backgroundGradient");
  const resolvedBackgroundImage = [
    value("overlayGradient") || (value("overlayColor")
      ? `linear-gradient(color-mix(in srgb, ${value("overlayColor")} ${(Number(value("overlayOpacity") ?? 0.35) * 100)}%, transparent), color-mix(in srgb, ${value("overlayColor")} ${(Number(value("overlayOpacity") ?? 0.35) * 100)}%, transparent))`
      : ""),
    overlayImage ? `url("${getImageUrl(String(overlayImage))}")` : "",
    backgroundGradient || (backgroundImage ? `url("${getImageUrl(String(backgroundImage))}")` : value("backgroundType") === "slideshow" && Array.isArray(value("backgroundSlideshow")) && value("backgroundSlideshow")[0] ? `url("${value("backgroundSlideshow")[0]}")` : ""),
  ].filter(Boolean).join(", ") || undefined;

  const gridColumns = responsive.gridColumns ?? base.gridColumns;
  const gridRows = responsive.gridRows ?? base.gridRows;

  // Element alignment is separate from text alignment and is resolved per widget.
  // Accept the names used by different versions of the builder settings panel.
  const elementAlign = String(
    value("elementAlign") ?? value("horizontalAlign") ?? value("align") ?? "",
  ).toLowerCase();
  const alignmentMargins: Pick<React.CSSProperties, "marginLeft" | "marginRight"> =
    elementAlign === "center" || elementAlign === "middle"
      ? { marginLeft: "auto", marginRight: "auto" }
      : elementAlign === "right" || elementAlign === "end"
        ? { marginLeft: "auto", marginRight: undefined }
        : elementAlign === "left" || elementAlign === "start"
          ? { marginLeft: undefined, marginRight: "auto" }
          : {};

  return {
    boxSizing: "border-box",

    width: normalizeSize(value("width")),
    height: normalizeSize(value("height")),
    minWidth: normalizeSize(value("minWidth")),
    maxWidth: normalizeSize(value("maxWidth")) ?? "100%",
    minHeight: normalizeSize(value("minHeight")),
    maxHeight: normalizeSize(value("maxHeight")),
    aspectRatio: value("aspectRatio"),

    display,
    flexDirection: flexDirection as React.CSSProperties["flexDirection"],
    flexWrap: value("flexWrap") as React.CSSProperties["flexWrap"],
    flexGrow: value("flexGrow"),
    flexShrink: value("flexShrink"),
    flexBasis: normalizeSize(value("flexBasis")),
    alignSelf: value("alignSelf") as React.CSSProperties["alignSelf"],
    order: value("order"),

    justifyContent: value("justifyContent") as React.CSSProperties["justifyContent"],
    alignItems: value("alignItems") as React.CSSProperties["alignItems"],
    alignContent: value("alignContent") as React.CSSProperties["alignContent"],

    gap: gap ?? (isFlexOrGrid ? "20px" : undefined),
    rowGap: rowGap ?? gap ?? (isFlexOrGrid ? "20px" : undefined),
    columnGap: columnGap ?? gap ?? (isFlexOrGrid ? "20px" : undefined),

    gridTemplateColumns:
      value("gridTemplateColumns") ??
      (gridColumns ? `repeat(${gridColumns}, minmax(0, 1fr))` : undefined),
    gridTemplateRows:
      value("gridTemplateRows") ??
      (gridRows ? `repeat(${gridRows}, minmax(0, 1fr))` : undefined),
    gridAutoFlow: value("gridAutoFlow"),
    gridColumn: value("gridColumn"),
    gridRow: value("gridRow"),

    backgroundColor: value("backgroundColor"),
    backgroundImage: value("backgroundType") === "slideshow" ? undefined : resolvedBackgroundImage,
    backgroundSize: value("backgroundSize") ?? "cover",
    backgroundPosition: value("backgroundPosition") ?? "center",
    backgroundRepeat: value("backgroundRepeat") ?? "no-repeat",
    backgroundAttachment: value("backgroundAttachment") as
      React.CSSProperties["backgroundAttachment"],
    backgroundClip: value("backgroundClip") as React.CSSProperties["backgroundClip"],

    color: value("color"),
    fontSize: normalizeSize(value("fontSize")),
    fontFamily: value("fontFamily"),
    fontWeight: value("fontWeight"),
    fontStyle: value("fontStyle"),
    lineHeight: value("lineHeight"),
    letterSpacing: normalizeSize(value("letterSpacing")),
    wordSpacing: normalizeSize(value("wordSpacing")),
    textAlign: value("textAlign") as React.CSSProperties["textAlign"],
    textTransform: value("textTransform") as React.CSSProperties["textTransform"],
    textDecoration: value("textDecoration"),
    textShadow: value("textShadow"),
    objectFit: value("objectFit") as React.CSSProperties["objectFit"],
    objectPosition: value("objectPosition"),

    padding: normalizeSpacing(value("padding")),
    margin: normalizeSpacing(value("margin")),
    ...alignmentMargins,

    borderColor: value("borderColor"),
    borderWidth: normalizeSize(value("borderWidth")),
    borderStyle: value("borderStyle") as React.CSSProperties["borderStyle"],
    borderRadius: normalizeSize(value("borderRadius")),
    transform: [
      value("rotate") ? `rotate(${value("rotate")}deg)` : "",
      value("scale") !== undefined && value("scale") !== 1 ? `scale(${value("scale")})` : "",
      value("translateX") ? `translateX(${normalizeSize(value("translateX"))})` : "",
      value("translateY") ? `translateY(${normalizeSize(value("translateY"))})` : "",
    ].filter(Boolean).join(" ") || undefined,
    filter: value("cssFilters"),
    borderTopWidth: normalizeSize(value("borderTopWidth")),
    borderRightWidth: normalizeSize(value("borderRightWidth")),
    borderBottomWidth: normalizeSize(value("borderBottomWidth")),
    borderLeftWidth: normalizeSize(value("borderLeftWidth")),
    borderTopColor: value("borderTopColor"),
    borderRightColor: value("borderRightColor"),
    borderBottomColor: value("borderBottomColor"),
    borderLeftColor: value("borderLeftColor"),
    borderTopLeftRadius: normalizeSize(value("borderTopLeftRadius")),
    borderTopRightRadius: normalizeSize(value("borderTopRightRadius")),
    borderBottomLeftRadius: normalizeSize(value("borderBottomLeftRadius")),
    borderBottomRightRadius: normalizeSize(value("borderBottomRightRadius")),
    boxShadow: value("boxShadow"),

    opacity: value("opacity"),
    position: (value("position") || (value("sticky") && value("sticky") !== "none" ? "sticky" : undefined)) as React.CSSProperties["position"],
    top: value("sticky") === "top" ? (normalizeSize(value("stickyOffset")) || "0px") : normalizeSize(value("top")),
    right: normalizeSize(value("right")),
    bottom: value("sticky") === "bottom" ? (normalizeSize(value("stickyOffset")) || "0px") : normalizeSize(value("bottom")),
    left: normalizeSize(value("left")),
    zIndex: value("zIndex"),
    // Do not force hidden overflow: dropdowns, popovers and hover effects may need it.
    overflow: value("overflow") as React.CSSProperties["overflow"],
    clipPath: value("maskShape") === "circle" ? "circle(50% at 50% 50%)" : value("maskShape") === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : value("maskShape") === "diamond" ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" : value("maskShape") === "hexagon" ? "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" : undefined,
    cursor: value("cursor"),
    pointerEvents: value("pointerEvents") as React.CSSProperties["pointerEvents"],

    transitionDuration:
      value("transitionDuration") !== undefined
        ? `${value("transitionDuration")}ms`
        : undefined,
  };
};

// ============ LINK WRAPPER ============
const MaybeLink = ({
  widget,
  children,
  linkUrl,
}: {
  widget: PageWidget;
  children: React.ReactNode;
  linkUrl?: string | null;
}) => {
  const resolvedUrl =
    linkUrl !== undefined ? linkUrl : widget.link?.url || widget.url;
  if (!resolvedUrl || resolvedUrl === "#") return <>{children}</>;

  return (
    <a
      href={resolvedUrl}
      target={widget.link?.target || "_self"}
      rel={widget.link?.noFollow ? "nofollow noopener" : undefined}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "contents",
      }}
    >
      {children}
    </a>
  );
};

// ============ SLIDER RENDERER ============
const SliderRenderer = ({ widget }: { widget: PageWidget }) => {
  const settings = widget.settings || {};
  const slides = widget.items || [];
  const images = settings.images || [];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSlides = Math.max(slides.length, images.length);

  const getSliderHeight = () => {
    if (settings.sliderHeight && typeof settings.sliderHeight === "number") {
      const unit = settings.sliderHeightUnit || "px";
      return `${settings.sliderHeight}${unit}`;
    }
    switch (settings.sliderHeight as any) {
      case "small":
        return "300px";
      case "large":
        return "700px";
      case "full":
        return "100vh";
      default:
        return "500px";
    }
  };

  const navigation = settings.navigation || "arrows-dots";
  const showArrows =
    navigation === "arrows" ||
    navigation === "arrows-dots" ||
    settings.showArrows === true;
  const showDots =
    navigation === "dots" ||
    navigation === "arrows-dots" ||
    settings.showDots === true;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  useEffect(() => {
    if (settings.autoplay === false || isPaused || totalSlides <= 1) return;
    autoplayRef.current = setInterval(
      nextSlide,
      settings.autoplaySpeed || 5000,
    );
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [
    settings.autoplay,
    settings.autoplaySpeed,
    isPaused,
    totalSlides,
    nextSlide,
  ]);

  if (totalSlides === 0) return null;

  const currentImage = images[currentSlide];
  const currentItem = slides[currentSlide];
  const imageUrl = currentImage?.url || currentItem?.image || "";

  const horizontalAlign = currentItem?.contentPosition || "center";
  const contentJustify =
    horizontalAlign === "left"
      ? "flex-start"
      : horizontalAlign === "right"
        ? "flex-end"
        : "center";

  const contentAlign = currentItem?.contentTextAlign || "center";
  const contentColor = currentItem?.contentColor || "#ffffff";
  const overlayColor = widget.style?.overlayColor || "#000000";
  const overlayOpacity = widget.style?.overlayOpacity ?? 0.5;
  const buttonStyle = settings.buttonStyle || "solid";

  return (
    <div
      className="public-slider"
      style={{
        position: "relative",
        width: "100%",
        height: getSliderHeight(),
        minHeight: "300px",
        overflow: "hidden",
        borderRadius: widget.style?.borderRadius
          ? `${widget.style.borderRadius}px`
          : "8px",
        backgroundColor: "#000",
      }}
      onMouseEnter={() => settings.pauseOnHover !== false && setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {imageUrl && (
        <img
          key={currentSlide}
          src={getImageUrl(imageUrl)}
          alt={currentImage?.alt || currentItem?.imageAlt || ""}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: `opacity ${settings.transitionSpeed || 500}ms ease`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: overlayColor,
          opacity: overlayOpacity,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: contentJustify,
          justifyContent: "center",
          padding: "40px 60px",
          textAlign: contentAlign as any,
          color: contentColor,
        }}
      >
        <div style={{ maxWidth: 800, width: "100%" }}>
          {currentItem?.title && (
            <h2
              style={{
                fontSize: 48,
                fontWeight: 700,
                margin: "0 0 16px",
                color: contentColor,
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                lineHeight: 1.2,
              }}
            >
              {currentItem.title}
            </h2>
          )}

          {currentItem?.content && (
            <p
              style={{
                fontSize: 18,
                margin: "0 0 24px",
                color: contentColor,
                lineHeight: 1.6,
                textShadow: "0 1px 6px rgba(0,0,0,0.4)",
              }}
            >
              {currentItem.content}
            </p>
          )}

          {(currentItem?.button1Text || currentItem?.button2Text) && (
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: contentJustify,
                marginTop: 8,
              }}
            >
              {currentItem?.button1Text && (
                <a
                  href={currentItem.button1Link || "#"}
                  style={{
                    display: "inline-block",
                    padding: "12px 28px",
                    borderRadius: 6,
                    background:
                      buttonStyle === "outline" ? "transparent" : "#0c2f55",
                    color: buttonStyle === "outline" ? "#0c2f55" : "#fff",
                    border:
                      buttonStyle === "outline" ? "2px solid #0c2f55" : "none",
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 15,
                  }}
                >
                  {currentItem.button1Text}
                </a>
              )}

              {currentItem?.button2Text && (
                <a
                  href={currentItem.button2Link || "#"}
                  style={{
                    display: "inline-block",
                    padding: "12px 28px",
                    borderRadius: 6,
                    background: "transparent",
                    color: contentColor,
                    border: `2px solid ${contentColor}`,
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 15,
                  }}
                >
                  {currentItem.button2Text}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {showArrows && totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              left: 20,
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              color: "#0c2f55",
              border: "none",
              fontSize: 28,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={nextSlide}
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              right: 20,
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              color: "#0c2f55",
              border: "none",
              fontSize: 28,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            ›
          </button>
        </>
      )}

      {showDots && totalSlides > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 10,
            zIndex: 10,
          }}
        >
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentSlide(i)}
              style={{
                width: i === currentSlide ? 24 : 12,
                height: 12,
                borderRadius: 6,
                border: "none",
                background:
                  i === currentSlide ? "#fff" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============ MENU RENDERER ============
const DEFAULT_MENU_ITEMS = [
  { id: "1", title: "Home", link: { url: "/" } },
  { id: "2", title: "About", link: { url: "/about" } },
  { id: "3", title: "Contact", link: { url: "/contact" } },
];

const buildMenuTree = (items: any[]) => {
  const nodes = new Map<string, any>();
  const roots: any[] = [];

  items.forEach((item, index) => {
    const id = String(item.id || item._id || `menu-item-${index}`);
    const itemLink =
      item.url ||
      item.link?.url ||
      (typeof item.link === "string" ? item.link : "#");

    nodes.set(id, {
      id,
      title: item.title || item.label || "Menu Item",
      link: { url: itemLink },
      children: [],
    });
  });

  items.forEach((item, index) => {
    const id = String(item.id || item._id || `menu-item-${index}`);
    const node = nodes.get(id);
    const rawParentId = item.parent_id ?? item.parentId;
    const parent = rawParentId ? nodes.get(String(rawParentId)) : null;

    if (parent && parent.id !== id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

const MenuRenderer = ({
  widget,
  color,
  fontSize,
  s,
  rs,
}: {
  widget: PageWidget;
  color: string;
  fontSize: number;
  s: any;
  rs: any;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedMenuId = widget.settings?.selectedMenuId;
  const fallbackItems =
    widget.settings?.items || widget.items || DEFAULT_MENU_ITEMS;
  const [loadedMenu, setLoadedMenu] = useState<{
    id: string;
    items: any[];
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!selectedMenuId) return;

    let active = true;

    getPublicMenu(String(selectedMenuId))
      .then((menu) => {
        if (active) {
          setLoadedMenu({
            id: String(selectedMenuId),
            items: buildMenuTree(Array.isArray(menu.items) ? menu.items : []),
          });
        }
      })
      .catch((error) => {
        console.error("PUBLIC MENU LOAD ERROR:", error);
        if (!active) return;

        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setLoadedMenu({ id: String(selectedMenuId), items: [] });
        } else {
          setLoadedMenu({
            id: String(selectedMenuId),
            items: fallbackItems,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [selectedMenuId, fallbackItems]);

  const items = selectedMenuId
    ? loadedMenu?.id === String(selectedMenuId)
      ? loadedMenu.items
      : []
    : fallbackItems;

  const menuGap = s.gap ?? 24;
  const menuJustify = (rs.justifyContent ||
    s.justifyContent ||
    "center") as any;
  const hamburgerColor = s.hamburgerColor || color || "#0c2f55";
  const mobileMenuBg = s.mobileMenuBgColor || "#ffffff";
  const breakpoint = s.mobileBreakpoint === "tablet" ? 1024 : 768;
  const uid = `nav-${widget.id.replace(/[^a-z0-9]/gi, "")}`;
  const menuFontSize = s.fontSize || fontSize || 15;
  const menuFontWeight = s.fontWeight || 500;
  const hoverColor = s.hoverColor || "#f0b429";

  const cssText = `
    .${uid}-wrapper { display: flex; align-items: center; justify-content: space-between; width: 100%; position: relative; }
    .${uid}-toggle { display: none; }
    .${uid}-list { display: flex; gap: ${menuGap}px; justify-content: ${menuJustify}; align-items: center; flex-wrap: wrap; margin: 0; padding: 0; list-style: none; }
    .${uid}-list > li { position: relative; }
    .${uid}-list > li > a {
      color: ${color || "#1a1a2e"};
      text-decoration: none;
      font-weight: ${menuFontWeight};
      font-size: ${menuFontSize}px;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 0;
      cursor: pointer;
    }
    .${uid}-list > li > a:hover { color: ${hoverColor}; text-decoration: ${s.hoverTextDecoration || "none"}; }
    .${uid}-submenu {
      position: absolute; top: 100%; left: 0; min-width: 200px; background: ${mobileMenuBg};
      box-shadow: 0 8px 24px rgba(0,0,0,0.15); border-radius: 6px; padding: 8px 0; margin: 0;
      list-style: none; opacity: 0; visibility: hidden; transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
      z-index: 100; pointer-events: none;
    }
    .${uid}-list > li:hover > .${uid}-submenu {
      opacity: 1; visibility: visible; transform: translateY(0); pointer-events: auto;
    }
    .${uid}-submenu li { position: relative; }
    .${uid}-submenu a {
      display: block; padding: 10px 20px; color: ${color || "#1a1a2e"};
      font-size: ${Math.max(menuFontSize - 1, 12)}px; font-weight: 400;
      white-space: nowrap; text-decoration: none; cursor: pointer;
    }
    .${uid}-submenu a:hover { background: rgba(12, 47, 85, 0.08); color: ${hoverColor}; }
    .${uid}-submenu .${uid}-submenu { top: 0; left: 100%; transform: translateX(8px); }
    .${uid}-submenu li:hover > .${uid}-submenu { opacity: 1; visibility: visible; transform: translateX(0); }
    .${uid}-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; }
    @media (max-width: ${breakpoint}px) {
      .${uid}-toggle {
        display: flex; align-items: center; justify-content: center;
        width: 44px; height: 44px; background: transparent; border: none;
        cursor: pointer; padding: 0; z-index: 1001; margin-left: auto;
      }
      .${uid}-toggle span, .${uid}-toggle span::before, .${uid}-toggle span::after {
        display: block; width: 24px; height: 2px; background: ${hamburgerColor};
        transition: all 0.3s; position: relative;
      }
      .${uid}-toggle span::before, .${uid}-toggle span::after { content: ""; position: absolute; left: 0; }
      .${uid}-toggle span::before { top: -8px; }
      .${uid}-toggle span::after { top: 8px; }
      .${uid}-toggle.open span { background: transparent; }
      .${uid}-toggle.open span::before { top: 0; transform: rotate(45deg); }
      .${uid}-toggle.open span::after { top: 0; transform: rotate(-45deg); }
      .${uid}-list {
        display: flex; position: fixed; top: 0; right: 0; width: 300px;
        max-width: 85vw; height: 100vh; flex-direction: column;
        justify-content: flex-start; align-items: flex-start; gap: 0;
        padding: 80px 24px 24px; background: ${mobileMenuBg};
        box-shadow: -4px 0 24px rgba(0,0,0,0.15); z-index: 1000;
        transform: translateX(100%); transition: transform 0.3s ease-out;
        overflow-y: auto; flex-wrap: nowrap;
      }
      .${uid}-list.open { transform: translateX(0); }
      .${uid}-list > li { width: 100%; }
      .${uid}-list > li > a {
        width: 100%; padding: 14px 0; border-bottom: 1px solid rgba(0,0,0,0.08);
        font-size: 16px; display: flex; justify-content: space-between; white-space: normal;
      }
      .${uid}-submenu {
        position: static; opacity: 1; visibility: visible; transform: none;
        background: transparent; box-shadow: none; padding: 0 0 0 16px;
        display: none; pointer-events: auto;
      }
      .${uid}-submenu.open { display: block; }
      .${uid}-submenu a { color: ${color || "#1a1a2e"}; font-size: 14px; padding: 10px 0; }
      .${uid}-backdrop.open { display: block; }
    }
  `;

  const handleMenuItemClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string,
    hasChildren: boolean,
  ) => {
    if (hasChildren && window.innerWidth <= breakpoint) {
      e.preventDefault();
      const submenu = e.currentTarget.nextElementSibling as HTMLElement;
      submenu?.classList.toggle("open");
      return;
    }
    if (url && url !== "#" && url.startsWith("/")) {
      if (url === location.pathname) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      setMenuOpen(false);
      navigate(url);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderMenuItem = (item: any, depth: number = 0): React.ReactNode => {
    const hasChildren =
      item.children && Array.isArray(item.children) && item.children.length > 0;
    const itemKey = item.id || `${depth}-${item.title}`;
    const itemUrl = item.link?.url || item.url || "#";

    return (
      <li key={itemKey}>
        <a
          href={itemUrl}
          onClick={(e) => handleMenuItemClick(e, itemUrl, hasChildren)}
        >
          {item.title}
          {hasChildren && (
            <span style={{ marginLeft: 6, fontSize: "0.7em", opacity: 0.7 }}>
              ▾
            </span>
          )}
        </a>
        {hasChildren && (
          <ul className={`${uid}-submenu`}>
            {item.children.map((child: any) =>
              renderMenuItem(child, depth + 1),
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssText }} />
      <div className={`${uid}-wrapper nav-menu-widget-wrapper`}>
        <button
          type="button"
          className={`${uid}-toggle${menuOpen ? " open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls={`${uid}-list`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <span aria-hidden="true" />
        </button>
        <ul
          id={`${uid}-list`}
          className={`${uid}-list nav-menu-widget${menuOpen ? " open" : ""}`}
        >
          {items.map((item) => renderMenuItem(item, 0))}
        </ul>
        <div
          className={`${uid}-backdrop${menuOpen ? " open" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(false);
          }}
        />
      </div>
    </>
  );
};

// ============ SITE LOGO ============
const SiteLogoRenderer = ({
  widget,
  s,
  fontSize,
  color,
}: {
  widget: PageWidget;
  s: any;
  fontSize: number;
  color: string;
}) => {
  const navigate = useNavigate();
  const hover = getHoverAndAnimation(s, widget.id);
  const imageLinkType = widget.settings?.imageLinkType;
  const isMediaLink = imageLinkType === "media";
  const linkUrl =
    imageLinkType === "none"
      ? ""
      : isMediaLink
        ? widget.url || ""
        : widget.link?.url || "/";

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      isMediaLink ||
      widget.link?.target === "_blank" ||
      !linkUrl.startsWith("/")
    )
      return;
    e.preventDefault();
    navigate(linkUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <StyleInjector css={hover.cssText} />
      <a
        href={linkUrl || undefined}
        target={widget.link?.target || "_self"}
        rel={
          widget.link?.noFollow
            ? "nofollow noopener"
            : widget.link?.target === "_blank"
              ? "noopener noreferrer"
              : undefined
        }
        onClick={linkUrl && !isMediaLink ? handleClick : undefined}
        className={`site-logo-widget ${hover.className}`.trim()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          textDecoration: "none",
          width: "auto",
          cursor: linkUrl ? "pointer" : "default",
        }}
      >
        {widget.url ? (
          <img
            src={getImageUrl(widget.url)}
            alt={widget.accessibility?.altText || "Logo"}
            style={{
              width: s.width || "auto",
              height: s.height || "auto",
              maxHeight: s.maxHeight || "50px",
              maxWidth: s.maxWidth || "none",
              objectFit: (s.objectFit as any) || "contain",
              objectPosition: s.objectPosition || "center",
              display: "block",
              pointerEvents: "none",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: `${fontSize || 22}px`,
              fontWeight: s.fontWeight || 700,
              color: color || "#0c2f55",
            }}
          >
            {widget.content || "Site Logo"}
          </span>
        )}
      </a>
    </>
  );
};

// ============ CART DROPDOWN WIDGET ============
const CartDropdownWidget = () => {
  const [showCart, setShowCart] = useState(false);

  return (
    <div className="custom-cart-widget" style={{ position: "relative", display: "inline-block" }}>
      <div 
        className="cart-icon-holder" 
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}
        onClick={() => setShowCart(!showCart)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <span className="cart-badge" style={{ background: "#cca06b", color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold" }}>1</span>
      </div>

      {showCart && (
        <div 
          className="cart-dropdown-panel" 
          style={{ position: "absolute", top: "100%", right: 0, width: 340, background: "#fff", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", borderRadius: 8, padding: 24, zIndex: 100, marginTop: 15 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h4 style={{ margin: 0, fontSize: 14, color: "#888", fontWeight: 600, textTransform: "uppercase" }}>Shopping Cart</h4>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}>🗑️</button>
          </div>
          
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <img src="https://via.placeholder.com/70" alt="Product" style={{ width: 70, height: 70, borderRadius: 8, objectFit: "cover", border: "1px solid #eee" }} />
            <div style={{ flex: 1 }}>
              <h5 style={{ margin: "0 0 6px", fontSize: 14, color: "#333", fontWeight: 500, lineHeight: 1.4 }}>Wedding Engagement Cubic Silver Band Ring</h5>
              <p style={{ margin: 0, color: "#888", fontSize: 13 }}>1 × $249.00</p>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "20px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, fontSize: 14, color: "#333" }}>
            <span>Subtotal :</span>
            <span style={{ fontWeight: 600, color: "#cca06b" }}>$249.00</span>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button style={{ flex: 1, padding: "12px 0", background: "#fff", border: "1px solid #cca06b", color: "#cca06b", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>View Cart</button>
            <button style={{ flex: 1, padding: "12px 0", background: "#cca06b", border: "1px solid #cca06b", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Checkout</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ WIDGET RENDERER ============
const WidgetRenderer = ({
  widget,
  device,
  pageId,
  pageTitle,
  product,
  isRoot = false,
}: {
  widget: PageWidget;
  device: ResponsiveDevice;
  pageId: string;
  pageTitle: string;
  product?: ProductData;
  isRoot?: boolean;
}) => {
  const s = widget.style;
  const rs = s.responsive?.[device] || {};

  const isHiddenOnDevice = (() => {
    const currentRs = s.responsive?.[device];
    if (currentRs?.hide === true) return true;
    if (device === "desktop" && s.responsive?.desktop?.hide === true)
      return true;
    if (device === "tablet" && s.responsive?.tablet?.hide === true) return true;
    if (device === "mobile" && s.responsive?.mobile?.hide === true) return true;
    return false;
  })();

  if (isHiddenOnDevice) return null;

  const fontSize = rs.fontSize ?? s.fontSize ?? 16;
  const textAlign = rs.textAlign ?? s.textAlign ?? "left";
  const color = rs.color ?? s.color ?? "#1a1a2e";
  const bgColor = rs.backgroundColor ?? s.backgroundColor;

  const baseStyle: React.CSSProperties = {
    ...renderStyles(widget.style, device),
    fontSize: `${fontSize}px`,
    textAlign: textAlign as any,
    color,
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
  };

  const isContainer = [
    "container", "section", "column", "grid",
    "box", "col", "flex", "flexbox", "fbox",
  ].includes(widget.type);

  if (isContainer) {
    const styles = renderStyles(widget.style, device);
    const rootWidth = styles.width;
    const rootHasConstrainedWidth =
      typeof rootWidth === "string" &&
      rootWidth !== "auto" &&
      !(rootWidth.endsWith("%") && Number.parseFloat(rootWidth) >= 100);
    const rootAlignment = String(
      widget.style.responsive?.[device]?.elementAlign ??
        widget.style.elementAlign ??
        "",
    ).toLowerCase();
    if (isRoot && rootHasConstrainedWidth && !rootAlignment) {
      styles.marginLeft = "auto";
      styles.marginRight = "auto";
    }
    if ((widget.style as any).backgroundType === "video") {
      styles.position = styles.position || "relative";
    }
    const ContainerTag: any = (widget.style as any).htmlTag || "div";
    let customAttributes: Record<string, any> = {};
    try {
      const parsed = JSON.parse(String((widget.style as any).customAttributes || "{}"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) customAttributes = parsed;
    } catch { /* Ignore invalid custom attribute JSON instead of breaking page rendering. */ }

    const displayValue =
      widget.style.responsive?.[device]?.display ?? widget.style.display;

    const flexDirectionValue =
      widget.style.responsive?.[device]?.flexDirection ??
      widget.style.flexDirection;

    let layoutClass = "layout-block";

    if (displayValue === "grid") {
      layoutClass = "layout-grid";
    } else if (displayValue === "flex") {
      layoutClass = `layout-flex-${flexDirectionValue || "row"}`;
    }
    const hasConstrainedWidth =
      typeof styles.width === "string" &&
      styles.width !== "auto" &&
      !(styles.width.endsWith("%") && Number.parseFloat(styles.width) >= 100);
    if (hasConstrainedWidth) {
      layoutClass += " has-explicit-width";
    }

    const hover = getHoverAndAnimation({ ...widget.style, ...(widget.style.responsive?.[device] || {}) }, widget.id);
    return (
      <>
      {hover.cssText ? <style data-builder-style="true" dangerouslySetInnerHTML={{ __html: hover.cssText }} /> : null}
      <ContainerTag
        {...customAttributes}
        id={(widget.style as any).cssId || undefined}
        style={styles}
        className={`public-widget public-widget-${widget.type} ${layoutClass} ${hover.className} ${(widget.style as any).customClasses || ""}`.trim()}
        data-widget-type={widget.type}
        data-widget-id={widget.id}
      >
        {(widget.style as any).backgroundType === "video" && (widget.style as any).backgroundVideo ? <video aria-hidden="true" autoPlay muted loop playsInline src={(widget.style as any).backgroundVideo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }} /> : null}
        {widget.children?.map((child) => (
          <WidgetRenderer
            key={child.id}
            widget={child}
            device={device}
            pageId={pageId}
            pageTitle={pageTitle}
            product={product}
          />
        ))}
      </ContainerTag>
      </>
    );
  }

  const renderWidgetContent = () => {
  switch (widget.type) {
    case "product_title":
      return <div style={baseStyle}>{product?.title || "Product Title"}</div>;

    case "product_price":
      return (
        <div style={{ ...baseStyle, fontWeight: 700 }}>
          {product ? <ProductPrice product={product} /> : "Product Price"}
        </div>
      );

    case "product_image":
      return product?.image ? (
        <img
          src={getImageUrl(product.image)}
          alt={product.title}
          style={{
            ...renderStyles(widget.style, device),
            display: "block",
            width: s.width || "100%",
            height: s.height || "auto",
            maxWidth: "100%",
            objectFit: s.objectFit || "contain",
          }}
        />
      ) : (
        <div style={{ ...baseStyle, padding: 24 }}>Product Image</div>
      );

    case "product_gallery":
      return (
        <div style={renderStyles(widget.style, device)}>
          <ProductGalleryWidget product={product} />
        </div>
      );

    case "product_description":
      return (
        <div style={baseStyle}>
          {product?.description || "Product Description"}
        </div>
      );

    case "product_short_description":
      return (
        <div style={baseStyle}>
          {product?.short_description ||
            product?.excerpt ||
            "Product Short Description"}
        </div>
      );

    case "product_sku":
      return <div style={baseStyle}>{product?.sku || "SKU: —"}</div>;

    case "product_categories":
      return (
        <div style={baseStyle}>{product?.category || "Product Categories"}</div>
      );

    case "product_tags":
      return (
        <div style={baseStyle}>
          {product?.tags?.length ? product.tags.join(", ") : "Product Tags"}
        </div>
      );

    case "product_attributes":
      return (
        <div style={renderStyles(widget.style, device)}>
          <ProductAttributesWidget product={product} />
        </div>
      );

    case "product_variations":
      return (
        <div style={renderStyles(widget.style, device)}>
          <ProductVariationsWidget product={product} />
        </div>
      );

    case "product_stock":
      return (
        <div style={baseStyle}>
          {product
            ? product.stock_status === "out_of_stock"
              ? "Out of stock"
              : product.manage_stock === false
                ? "In stock"
                : product.quantity > 0
                  ? `In stock (${product.quantity})`
                  : "Out of stock"
            : "Product Stock"}
        </div>
      );

    case "quantity":
      return (
        <div style={renderStyles(widget.style, device)}>
          <ProductQuantityWidget product={product} />
        </div>
      );

    case "add_to_cart":
      return (
        <ProductAddToCart
          product={product}
          style={renderStyles(widget.style, device)}
        />
      );

    case "cart":
      return <CartDropdownWidget />;
      
    case "checkout":
    case "my_account":
    case "order_summary":
      return (
        <Suspense
          fallback={<div style={baseStyle}>Loading store section…</div>}
        >
          <StorefrontWidget
            page={
              widget.type === "my_account"
                ? "account"
                : widget.type === "order_summary"
                  ? "received"
                  : widget.type
            }
            embedded
            settings={widget.settings}
          />
        </Suspense>
      );

    case "products":
    case "product_grid":
      return (
        <div style={renderStyles(widget.style, device)}>
          <ProductGridWidget
            limit={widget.settings?.postsPerPage || 8}
            columns={widget.settings?.columns || 4}
            query="all"
          />
        </div>
      );

    case "related_products":
      return (
        <div style={renderStyles(widget.style, device)}>
          <ProductGridWidget
            limit={widget.settings?.postsPerPage || 4}
            columns={widget.settings?.columns || 4}
            query="related"
            productId={product?.id}
          />
        </div>
      );

    case "recent_products":
      return (
        <div style={renderStyles(widget.style, device)}>
          <ProductGridWidget
            limit={widget.settings?.postsPerPage || 4}
            columns={widget.settings?.columns || 4}
            query="recent"
          />
        </div>
      );

    case "heading": {
      const tag = (s.htmlTag || "h2").toLowerCase();
      const validTags = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "div",
        "span",
      ];
      const HeadingTag = (validTags.includes(tag) ? tag : "h2") as any;
      const headingTextAlign = (rs.textAlign || s.textAlign || "left") as any;
      const hover = getHoverAndAnimation(s, widget.id);

      return (
        <>
          <StyleInjector css={hover.cssText} />
          <MaybeLink widget={widget}>
            <div
              style={{
                width: baseStyle.width || "100%",
                maxWidth: baseStyle.maxWidth || "100%",
                textAlign: headingTextAlign,
                marginLeft: baseStyle.marginLeft,
                marginRight: baseStyle.marginRight,
                boxSizing: "border-box",
              }}
            >
              <HeadingTag
                className={hover.className}
                style={{
                  ...baseStyle,
                  textAlign: headingTextAlign,
                  margin: 0,
                  padding: 0,
                  display: "block",
                  width: baseStyle.width || undefined,
                  maxWidth: baseStyle.maxWidth || undefined,
                }}
                dangerouslySetInnerHTML={{ __html: widget.content || "" }}
              />
            </div>
          </MaybeLink>
        </>
      );
    }

    case "text": {
      const textTextAlign = (rs.textAlign || s.textAlign || "left") as any;
      const hover = getHoverAndAnimation(s, widget.id);

      return (
        <>
          <StyleInjector css={hover.cssText} />
          <MaybeLink widget={widget}>
            <div
              className={hover.className}
              style={{
                ...baseStyle,
                textAlign: textTextAlign,
                width: baseStyle.width || "100%",
                display: "block",
                margin: 0,
                padding: 0,
              }}
              dangerouslySetInnerHTML={{ __html: widget.content || "" }}
            />
          </MaybeLink>
        </>
      );
    }

    case "button": {
      const btnTextAlign = (rs.textAlign || s.textAlign || "left") as any;
      const buttonHoverBackgroundColor =
        rs.buttonHoverBackgroundColor ??
        s.buttonHoverBackgroundColor ??
        s.hoverBackgroundColor;
      const hover = getHoverAndAnimation(
        {
          ...s,
          hoverBackgroundColor: buttonHoverBackgroundColor,
          ...(buttonHoverBackgroundColor
            ? { hoverBackgroundGradient: "none" }
            : {}),
        },
        widget.id,
      );
      const buttonPadding =
        rs.buttonPadding || s.buttonPadding || rs.padding || s.padding;
      const buttonPaddingUnit = buttonPadding?.unit || "px";
      const buttonBackgroundType =
        rs.buttonBackgroundType ?? s.buttonBackgroundType ?? "classic";
      const buttonBackgroundColor =
        rs.buttonBackgroundColor ??
        s.buttonBackgroundColor ??
        rs.backgroundColor ??
        s.backgroundColor ??
        "#0c2f55";
      const buttonBorderRadius =
        rs.buttonBorderRadius ??
        s.buttonBorderRadius ??
        rs.borderRadius ??
        s.borderRadius;
      const buttonBorderWidth =
        rs.buttonBorderWidth ??
        s.buttonBorderWidth ??
        rs.borderWidth ??
        s.borderWidth;

      return (
        <>
          <StyleInjector css={hover.cssText} />
          <div
            style={{
              ...baseStyle,
              display: "block",
              textAlign: btnTextAlign,
              width: baseStyle.width || "100%",
              minWidth: 0,
            }}
          >
            <a
              href={widget.link?.url || widget.url || "#"}
              target={widget.link?.target || "_self"}
              className={hover.className}
              style={{
                boxSizing: "border-box",
                maxWidth: "100%",
                textAlign: btnTextAlign,
                backgroundColor:
                  buttonBackgroundType === "gradient"
                    ? rs.buttonBackgroundGradientColor1 ??
                      s.buttonBackgroundGradientColor1 ??
                      "#0c2f55"
                    : buttonBackgroundColor,
                backgroundImage:
                  buttonBackgroundType === "gradient"
                    ? `linear-gradient(${rs.buttonBackgroundGradientAngle ?? s.buttonBackgroundGradientAngle ?? 135}deg, ${rs.buttonBackgroundGradientColor1 ?? s.buttonBackgroundGradientColor1 ?? "#0c2f55"}, ${rs.buttonBackgroundGradientColor2 ?? s.buttonBackgroundGradientColor2 ?? "#ffffff"})`
                    : undefined,
                color: rs.color || s.color || "#ffffff",
                padding: buttonPadding
                  ? `${buttonPadding.top ?? 12}${buttonPaddingUnit} ${buttonPadding.right ?? 24}${buttonPaddingUnit} ${buttonPadding.bottom ?? 12}${buttonPaddingUnit} ${buttonPadding.left ?? 24}${buttonPaddingUnit}`
                  : "12px 24px",
                borderRadius: buttonBorderRadius ? `${buttonBorderRadius}px` : "6px",
                borderColor:
                  rs.buttonBorderColor ||
                  s.buttonBorderColor ||
                  rs.borderColor ||
                  s.borderColor ||
                  undefined,
                borderWidth: buttonBorderWidth ? `${buttonBorderWidth}px` : undefined,
                borderStyle:
                  rs.buttonBorderStyle ||
                  s.buttonBorderStyle ||
                  rs.borderStyle ||
                  s.borderStyle ||
                  undefined,
                borderTopWidth:
                  rs.buttonBorderTopWidth ?? s.buttonBorderTopWidth ?? rs.borderTopWidth ?? s.borderTopWidth,
                borderRightWidth:
                  rs.buttonBorderRightWidth ?? s.buttonBorderRightWidth ?? rs.borderRightWidth ?? s.borderRightWidth,
                borderBottomWidth:
                  rs.buttonBorderBottomWidth ?? s.buttonBorderBottomWidth ?? rs.borderBottomWidth ?? s.borderBottomWidth,
                borderLeftWidth:
                  rs.buttonBorderLeftWidth ?? s.buttonBorderLeftWidth ?? rs.borderLeftWidth ?? s.borderLeftWidth,
                borderTopLeftRadius:
                  rs.buttonBorderTopLeftRadius ?? s.buttonBorderTopLeftRadius ?? rs.borderTopLeftRadius ?? s.borderTopLeftRadius,
                borderTopRightRadius:
                  rs.buttonBorderTopRightRadius ?? s.buttonBorderTopRightRadius ?? rs.borderTopRightRadius ?? s.borderTopRightRadius,
                borderBottomLeftRadius:
                  rs.buttonBorderBottomLeftRadius ?? s.buttonBorderBottomLeftRadius ?? rs.borderBottomLeftRadius ?? s.borderBottomLeftRadius,
                borderBottomRightRadius:
                  rs.buttonBorderBottomRightRadius ?? s.buttonBorderBottomRightRadius ?? rs.borderBottomRightRadius ?? s.borderBottomRightRadius,
                display: "inline-block",
                fontWeight: s.fontWeight || 600,
                textDecoration: "none",
              }}
            >
              {widget.content}
            </a>
          </div>
        </>
      );
    }

    case "image": {
      if (!widget.url) return null;
      const hover = getHoverAndAnimation(s, widget.id);
      const imageStyle = renderStyles(s, device);

      return (
        <>
          <StyleInjector css={hover.cssText} />
          <div style={{ display: "flex", justifyContent: (rs.elementAlign || s.elementAlign) === "center" ? "center" : (rs.elementAlign || s.elementAlign) === "right" ? "flex-end" : "flex-start", width: "100%" }}>
          <MaybeLink
            widget={widget}
            linkUrl={
              widget.settings?.imageLinkType === "none"
                ? null
                : widget.settings?.imageLinkType === "media"
                  ? widget.url
                  : widget.link?.url || null
            }
          >
            <img
              src={getImageUrl(widget.url)}
              alt={widget.accessibility?.altText || widget.label || "Image"}
              className={hover.className}
              style={{
                ...imageStyle,
                boxSizing: "border-box",
                width: imageStyle.width || "100%",
                height: imageStyle.height || "auto",
                maxWidth: imageStyle.maxWidth || "100%",
                display: "block",
                borderRadius: imageStyle.borderRadius || "8px",
                objectFit: imageStyle.objectFit || "cover",
                objectPosition: imageStyle.objectPosition || "center",
                boxShadow: s.boxShadow,
              }}
            />
          </MaybeLink>
          </div>
          {widget.settings?.captionType &&
            widget.settings.captionType !== "none" && (
              <div
                className="widget-image-caption"
                style={{
                  marginTop: 6,
                  textAlign: (imageStyle.textAlign as React.CSSProperties["textAlign"]) || "left",
                  color: s.color || "inherit",
                  fontSize: 13,
                }}
              >
                {widget.settings.captionType === "custom"
                  ? widget.settings.captionText || ""
                  : widget.label}
              </div>
            )}
        </>
      );
    }

    case "site_logo":
      return (
        <SiteLogoRenderer
          widget={widget}
          s={s}
          fontSize={fontSize}
          color={color}
        />
      );

    case "site_title": {
      const siteTitleAlign = (rs.textAlign || s.textAlign || "left") as any;
      return (
        <h1
          style={{
            ...baseStyle,
            margin: 0,
            padding: 0,
            fontSize: `${fontSize || 24}px`,
            fontWeight: s.fontWeight || 700,
            textAlign: siteTitleAlign,
          }}
        >
          {widget.content || "Site Title"}
        </h1>
      );
    }

    case "site_tagline": {
      const taglineAlign = (rs.textAlign || s.textAlign || "left") as any;
      return (
        <p
          style={{
            ...baseStyle,
            margin: 0,
            fontSize: `${fontSize || 14}px`,
            opacity: 0.75,
            textAlign: taglineAlign,
          }}
        >
          {widget.content || "Your site tagline here"}
        </p>
      );
    }

    case "nav_menu":
    case "footer_menu":
    case "menu":
      return (
        <MenuRenderer
          widget={widget}
          color={color}
          fontSize={fontSize}
          s={s}
          rs={rs}
        />
      );

    case "copyright": {
      const copyrightAlign = (rs.textAlign || s.textAlign || "center") as any;
      return (
        <div
          style={{
            ...baseStyle,
            fontSize: `${fontSize || 14}px`,
            textAlign: copyrightAlign,
            padding: "8px 0",
            width: "100%",
            opacity: s.opacity ?? 0.9,
          }}
        >
          {widget.content ||
            `© ${new Date().getFullYear()} All rights reserved.`}
        </div>
      );
    }

    case "video": {
      if (!widget.url) return null;
      return (
        <div
          style={{
            position: "relative",
            paddingBottom: "56.25%",
            height: 0,
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
            overflow: "hidden",
            width: s.width || "100%",
          }}
        >
          {widget.url.match(/\.(mp4|webm|ogg)$/i) ? (
            <video
              src={getImageUrl(widget.url)}
              controls
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
            <iframe
              src={widget.url}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
              }}
              allowFullScreen
            />
          )}
        </div>
      );
    }

    case "icon_list":
      return (
        <ul
          className="builder-icon-list"
          style={{
            ...renderStyles(widget.style, device),
            listStyle: "none",
            display: "flex",
            flexDirection: widget.settings?.iconListLayout === "inline"
              ? "row"
              : (s.flexDirection as "row" | "column") || "column",
            flexWrap: "wrap",
            gap: `${s.gap ?? 12}px`,
            padding: 0,
            margin: 0,
          }}
        >
          {(widget.items || []).map((item) => {
            const itemContent = (
              <>
                {item.iconType === "text" ? null : item.iconType === "image" || item.image ? (
                  <img
                    src={getImageUrl(item.image)}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: `${s.iconSize || 20}px`,
                      height: `${s.iconSize || 20}px`,
                      objectFit: "contain",
                      flex: "0 0 auto",
                    }}
                  />
                ) : (
                  (FaIcons as any)[item.icon || ""] ? (
                    <SocialIconGlyph name={item.icon} size={s.iconSize || 20} />
                  ) : (
                    <BuilderIcon
                      name={item.icon}
                      style={{
                        color: s.iconColor || color || "#0c2f55",
                        fontSize: `${s.iconSize || 20}px`,
                        lineHeight: 1,
                      }}
                    />
                  )
                )}
                <span>{item.title || item.content}</span>
              </>
            );

            return (
              <li
                key={item.id}
                style={{
                  width:
                    widget.settings?.iconListLinkFullWidth && item.link?.url
                      ? "100%"
                      : undefined,
                }}
              >
                {item.link?.url ? (
                  <a
                    href={item.link.url}
                    target={item.link.target || "_self"}
                    rel={
                      item.link.noFollow
                        ? "nofollow noopener"
                        : item.link.target === "_blank"
                          ? "noopener noreferrer"
                          : undefined
                    }
                    style={{
                      display: "inline-flex",
                      width: widget.settings?.iconListLinkFullWidth ? "100%" : undefined,
                      alignItems: "center",
                      gap: 10,
                      color: s.color || color || "inherit",
                      textDecoration: "none",
                    }}
                  >
                    {itemContent}
                  </a>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      width: widget.settings?.iconListLinkFullWidth ? "100%" : undefined,
                      alignItems: "center",
                      gap: 10,
                      color: s.color || color || "inherit",
                    }}
                  >
                    {itemContent}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      );

    case "icon": {
      const CustomFaIcon = widget.settings?.customIcon
        ? (FaIcons as any)[widget.settings.customIcon]
        : null;
      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              fontSize: `${fontSize || 48}px`,
              textAlign: "center",
              color: color || "#0c2f55",
              lineHeight: 1,
            }}
          >
            {widget.url ? (
              <img
                src={getImageUrl(widget.url)}
                alt={widget.accessibility?.altText || ""}
                style={{
                  width: `${fontSize || 48}px`,
                  height: `${fontSize || 48}px`,
                  objectFit: "contain",
                  verticalAlign: "middle",
                }}
              />
            ) : CustomFaIcon ? (
              <CustomFaIcon size={fontSize || 48} />
            ) : widget.settings?.customIcon ? (
              <BuilderIcon
                name={widget.settings.customIcon}
                style={{ fontSize: `${fontSize || 48}px`, color: color || "#0c2f55" }}
              />
            ) : (
              widget.content || "★"
            )}
          </div>
        </MaybeLink>
      );
    }

    case "icon_box": {
      const iconPosition = widget.settings?.iconPosition || "top";
      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              display: "flex",
              flexDirection: iconPosition === "left" || iconPosition === "right" ? "row" : "column",
              alignItems: "center",
              textAlign: iconPosition === "left" ? "left" : "center",
              gap: 16,
              padding: 24,
              color,
              backgroundColor: bgColor,
              borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
            }}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: iconPosition === "top" ? 16 : 0,
                order: iconPosition === "right" ? 1 : 0,
                flex: "0 0 auto",
                color: color || "#0c2f55",
              }}
            >
              {widget.url ? (
                <img src={getImageUrl(widget.url)} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
              ) : (
                <BuilderIcon name={widget.content || "FaStar"} style={{ fontSize: 48, color: s.iconColor || color || "#0c2f55" }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 20, color }}>
                {widget.items?.[0]?.title ||
                  widget.settings?.items?.[0]?.title ||
                  "Feature Title"}
              </h3>
              <p style={{ margin: 0, color, fontSize: 14, opacity: 0.75 }}>
                {widget.items?.[0]?.content ||
                  widget.settings?.items?.[0]?.content ||
                  "Add feature description here."}
              </p>
            </div>
          </div>
        </MaybeLink>
      );
    }

    case "image_box":
      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              overflow: "hidden",
              background: bgColor || "transparent",
              borderRadius: s.borderRadius ? `${s.borderRadius}px` : 8,
              textAlign: textAlign as any,
            }}
          >
            {widget.url && (
              <img
                src={getImageUrl(widget.url)}
                alt={widget.accessibility?.altText || ""}
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: s.maxHeight || "320px",
                  objectFit: s.objectFit || "cover",
                }}
              />
            )}
            <div style={{ padding: 20 }}>
              <h3 style={{ margin: "0 0 8px", color }}>
                {widget.settings?.title || "Image Box Title"}
              </h3>
              <p style={{ margin: 0, color }}>{widget.content}</p>
            </div>
          </div>
        </MaybeLink>
      );

    case "link_bio_minimalist":
    case "link_bio_classic":
    case "link_bio_showcase":
    case "link_bio_links":
    case "link_bio_services":
    case "link_bio_portfolio":
    case "link_bio_business_card": {
      const bioLayout = widget.type.replace("link_bio_", "");
      return (
        <section
          className={`builder-link-bio builder-link-bio-${bioLayout}`}
          style={{
            maxWidth: 480,
            width: "100%",
            margin: "0 auto",
            padding: 24,
            borderRadius: s.borderRadius ?? 16,
            background:
              bgColor ||
              (bioLayout === "minimalist"
                ? "transparent"
                : bioLayout === "portfolio"
                  ? "#f8f4ef"
                  : bioLayout === "services"
                    ? "#eff8f5"
                    : bioLayout === "showcase"
                      ? "#eef4ff"
                      : "#f7f8fa"),
            border:
              bioLayout === "business_card" ? "1px solid #dce2e8" : undefined,
            boxShadow:
              bioLayout === "showcase"
                ? "0 12px 30px rgba(12, 47, 85, 0.12)"
                : undefined,
            color: color || "#17202a",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          {widget.url && (
            <img
              src={getImageUrl(widget.url)}
              alt=""
              style={{
                width: 96,
                height: 96,
                borderRadius: bioLayout === "business_card" ? 12 : "50%",
                objectFit: "cover",
                margin: "0 auto 14px",
              }}
            />
          )}
          <h2 style={{ margin: "0 0 8px", fontSize: 24 }}>
            {widget.settings?.profileName || "Your Name"}
          </h2>
          {widget.content && (
            <p style={{ margin: "0 0 20px" }}>{widget.content}</p>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {(widget.items || []).map((item) => (
              <a
                key={item.id}
                href={item.link?.url || "#"}
                target={item.link?.target || "_self"}
                rel={
                  item.link?.target === "_blank"
                    ? "noopener noreferrer"
                    : undefined
                }
                style={{
                  display: "block",
                  padding: "12px 16px",
                  borderRadius:
                    bioLayout === "links" ? 999 : (s.borderRadius ?? 8),
                  background:
                    bioLayout === "minimalist" ? "transparent" : "#ffffff",
                  border:
                    bioLayout === "minimalist" ? "none" : "1px solid #dce2e8",
                  color: color || "#17202a",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {item.title}
              </a>
            ))}
          </div>
        </section>
      );
    }

    case "gallery":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${s.gridColumns || 3}, 1fr)`,
            gap: s.gridColumnGap || 12,
          }}
        >
          {(widget.settings?.images || []).map((img, i) => (
            <img
              key={img.id || i}
              src={getImageUrl(img.url)}
              alt={img.alt || ""}
              style={{
                width: "100%",
                height: 200,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          ))}
        </div>
      );

    case "carousel":
    case "slider":
      return <SliderRenderer widget={widget} />;

    case "spacer":
      return (
        <div
          aria-hidden="true"
          style={{
            height: `${s.spacerHeight ?? s.padding?.top ?? 50}${s.spacerUnit || "px"}`,
          }}
        />
      );

    case "divider":
      return (
        <hr
          style={{
            border: 0,
            borderTop: `${s.borderWidth || 1}px ${s.borderStyle || "solid"} ${s.borderColor || "#e0e0e0"}`,
            margin: "16px 0",
            width: renderStyles(widget.style, device).width || "100%",
            marginLeft: (rs.elementAlign || s.elementAlign) === "center" || (rs.elementAlign || s.elementAlign) === "right" ? "auto" : undefined,
            marginRight: (rs.elementAlign || s.elementAlign) === "center" ? "auto" : undefined,
          }}
        />
      );

    case "html":
      return <div dangerouslySetInnerHTML={{ __html: widget.content || "" }} />;

    case "map": {
      const address = widget.settings?.mapAddress || widget.content || "";
      return address ? (
        <iframe
          title={`Map: ${address}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ width: "100%", minHeight: 320, border: 0, borderRadius: 8 }}
        />
      ) : null;
    }

    case "soundcloud":
      return widget.url ? (
        <iframe
          title="SoundCloud player"
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(widget.url)}`}
          allow="autoplay"
          loading="lazy"
          style={{ width: "100%", height: 166, border: 0 }}
        />
      ) : null;

    case "shortcode":
      return (
        <code className="builder-shortcode">
          {widget.content || "[shortcode]"}
        </code>
      );

    case "menu_anchor": {
      const anchorId = (widget.content || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "-");
      return anchorId ? <span id={anchorId} aria-hidden="true" /> : null;
    }

    case "sidebar":
      return (
        <aside>
          {widget.content && <h3>{widget.content}</h3>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(widget.items || []).map((item) => (
              <li key={item.id} style={{ padding: "8px 0" }}>
                <a href={item.link?.url || "#"}>{item.title}</a>
              </li>
            ))}
          </ul>
        </aside>
      );

    case "read_more":
      return (
        <a
          href={widget.link?.url || widget.url || "#"}
          target={widget.link?.target || "_self"}
          rel={
            widget.link?.target === "_blank" ? "noopener noreferrer" : undefined
          }
          style={{
            display: "inline-block",
            padding: "10px 18px",
            borderRadius: s.borderRadius ?? 6,
            background: bgColor || "#0c2f55",
            color: color || "#ffffff",
            textDecoration: "none",
          }}
        >
          {widget.content || "Read More"}
        </a>
      );

    case "rating": {
      const rating = Math.max(0, Math.min(5, widget.settings?.rating ?? 4));
      return (
        <div
          role="img"
          aria-label={`${rating} out of 5 stars`}
          style={{ color: "#f0b429" }}
        >
          {"★".repeat(Math.floor(rating))}
          {rating % 1 ? "½" : ""}
          {"☆".repeat(5 - Math.ceil(rating))}
        </div>
      );
    }

    case "text_path":
      return (
        <svg
          viewBox="0 0 320 180"
          role="img"
          aria-label={widget.content || "Text on a path"}
          style={{ width: "100%", overflow: "visible" }}
        >
          <defs>
            <path
              id={`text-path-${widget.id}`}
              d="M 20,145 Q 160,-20 300,145"
            />
          </defs>
          <text fill={color || "#0c2f55"} fontSize={fontSize || 22}>
            <textPath
              href={`#text-path-${widget.id}`}
              startOffset="50%"
              textAnchor="middle"
            >
              {widget.content || "Text on a path"}
            </textPath>
          </text>
        </svg>
      );

    case "tablepress": {
      const headers: string[] = Array.isArray(widget.settings?.tableHeaders)
        ? widget.settings.tableHeaders.map((header: unknown) => String(header ?? ""))
        : ["Name", "Role"];
      return (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    scope="col"
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderBottom: "2px solid #d9dee7",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(widget.items || []).map((item) => (
                <tr key={item.id}>
                  <td
                    style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}
                  >
                    {item.title}
                  </td>
                  {headers.length > 1 && (
                    <td
                      style={{
                        padding: 10,
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      {item.content}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "alert":
      return (
        <div
          style={{
            padding: 16,
            background: bgColor || "#e8f4ff",
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "6px",
            color: color || "#0c2f55",
          }}
        >
          ℹ {widget.content}
        </div>
      );

    case "accordion":
    case "toggle":
      return (widget.items || []).length > 0 ? (
        <div
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {widget.items?.map((item, i) => (
            <details
              key={item.id}
              style={{
                borderBottom:
                  i < (widget.items?.length || 0) - 1
                    ? "1px solid #e0e0e0"
                    : "none",
              }}
              open={i === (widget.settings?.defaultActiveItem ?? 0)}
            >
              <summary
                style={{
                  padding: "14px 16px",
                  fontWeight: 600,
                  background: "#f8f9fc",
                  cursor: "pointer",
                }}
              >
                {item.title}
              </summary>
              <div style={{ padding: "12px 16px", color: "#666", fontSize: 14 }}>
                {item.image && <img src={item.image} alt={item.title || "Accordion image"} style={{ display: "block", width: "100%", maxWidth: "100%", height: "auto", objectFit: "cover", marginBottom: 12, borderRadius: 6 }} />}
                {item.content}
                {item.children?.map((child) => (
                  <WidgetRenderer
                    key={child.id}
                    widget={child}
                    device={device}
                    pageId={pageId}
                    pageTitle={pageTitle}
                    product={product}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : null;

    case "tabs":
      return (
        <InteractiveTabs
          items={widget.items || []}
          widgetId={widget.id}
          color={color || "#0c2f55"}
          renderChildren={(children) => children.map((child) => (
            <WidgetRenderer
              key={child.id}
              widget={child}
              device={device}
              pageId={pageId}
              pageTitle={pageTitle}
              product={product}
            />
          ))}
        />
      );

    case "testimonial":
      return (
        <PublicTestimonialCarousel
          items={widget.items || []}
          settings={widget.settings}
          color={color || "#0c2f55"}
          background={bgColor}
        />
      );

    case "counter":
      {
      const end =
        widget.settings?.counterEnd ??
        Number(widget.items?.[0]?.content || widget.settings?.items?.[0]?.content || widget.content || 1000);
      const CounterTitle = (["div", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(
        widget.settings?.counterTitleTag || "div",
      ) ? widget.settings?.counterTitleTag || "div" : "div") as ElementType;
      return (
        <div style={{ textAlign: "center", padding: 20 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: color || "#0c2f55",
              lineHeight: 1,
            }}
          >
            {widget.settings?.counterPrefix || ""}
            <AnimatedCounter
              start={widget.settings?.counterStart ?? 0}
              end={end}
              duration={widget.settings?.counterDuration ?? 2000}
              separator={widget.settings?.counterSeparator || ","}
              showSeparator={widget.settings?.counterThousandsSeparator !== false}
            />
            {widget.settings?.counterSuffix || ""}
          </div>
          <CounterTitle style={{ color, marginTop: 12, fontSize: 15, opacity: 0.75 }}>
            {widget.items?.[0]?.title ||
              widget.settings?.items?.[0]?.title ||
              "Happy Clients"}
          </CounterTitle>
        </div>
      );
      }

    case "progress_bar":
      {
      const percentage = Math.max(
        0,
        Math.min(
          100,
          Number(widget.settings?.progressPercent ?? widget.items?.[0]?.content ?? 50),
        ),
      );
      const ProgressTitle = (["span", "div", "p", "h1", "h2", "h3", "h4", "h5", "h6"].includes(
        widget.settings?.progressTitleTag || "span",
      ) ? widget.settings?.progressTitleTag || "span" : "span") as ElementType;
      return (
        <div style={{ padding: "8px 0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              color,
            }}
          >
            {widget.settings?.showProgressTitle !== false && (
              <ProgressTitle style={{ fontWeight: 600, margin: 0 }}>
                {widget.settings?.progressTitle || widget.items?.[0]?.title || "My Skill"}
              </ProgressTitle>
            )}
            {widget.settings?.showProgressPercent !== false && (
              <span>{percentage}%</span>
            )}
          </div>
          <div
            style={{
              background: "#e0e0e0",
              borderRadius: 6,
              height: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${percentage}%`,
                height: "100%",
                background: color || "#0c2f55",
                borderRadius: 6,
              }}
            >
              {widget.settings?.progressInnerText && (
                <span style={{
                  display: "block",
                  overflow: "hidden",
                  padding: "0 10px",
                  color: "#fff",
                  fontSize: 12,
                  lineHeight: "12px",
                  whiteSpace: "nowrap",
                }}>
                  {widget.settings.progressInnerText}
                </span>
              )}
            </div>
          </div>
        </div>
      );
      }

    case "form":
      return (
        <PublicFormWidget
          widget={widget}
          pageId={pageId}
          pageTitle={pageTitle}
          background={bgColor}
        />
      );

    case "search":
      return (
        <div style={{ display: "flex", maxWidth: 500, margin: "0 auto" }}>
          <input
            type="text"
            placeholder="Search..."
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "1px solid #d9dee7",
              borderRadius: "6px 0 0 6px",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            style={{
              padding: "12px 24px",
              background: "#0c2f55",
              color: "#fff",
              border: "none",
              borderRadius: "0 6px 6px 0",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🔍 Search
          </button>
        </div>
      );

    case "pagination": {
      const pagination = widget.settings || {};
      const buttons: { label: string; active?: boolean }[] = [];
      if (pagination.paginationShowPrev !== false) buttons.push({ label: pagination.paginationPrevText || "Previous" });
      if (pagination.paginationShowNumbers !== false) { buttons.push({ label: "1", active: true }, { label: "2" }, { label: "3" }); }
      if (pagination.paginationShowNext !== false) buttons.push({ label: pagination.paginationNextText || "Next" });
      const align = pagination.paginationAlignment || "center";
      return <nav aria-label="Pagination" style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : align === "space-between" ? "space-between" : "center", gap: `${pagination.paginationGap ?? 8}px`, width: "100%" }}>{buttons.map((button, index) => <button type="button" key={`${button.label}-${index}`} aria-current={button.active ? "page" : undefined} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", background: button.active ? (pagination.paginationActiveColor || "#0c2f55") : (pagination.paginationBackgroundColor || "#fff"), color: button.active ? "#fff" : (pagination.paginationTextColor || "#333"), fontWeight: button.active ? 700 : 400 }}>{button.label}</button>)}</nav>;
    }

    case "social_icons":
      return (
        <div
          style={{
            display: "flex",
            flexDirection: (s.flexDirection as "row" | "column") || "row",
            flexWrap: "wrap",
            gap: s.gap ?? 12,
            justifyContent: s.justifyContent || "center",
            alignItems: s.alignItems || "center",
            padding: 16,
          }}
        >
          {(widget.items || []).map((item) => (
            <a
              key={item.id}
              href={item.link?.url || "#"}
              target={item.link?.target || "_self"}
              rel={
                item.link?.target === "_blank"
                  ? "noopener noreferrer"
                  : undefined
              }
              aria-label={item.title || "Social profile"}
              title={item.title || "Social profile"}
              style={{
                width: s.iconSize ? Math.max(32, s.iconSize + 20) : 44,
                height: s.iconSize ? Math.max(32, s.iconSize + 20) : 44,
                borderRadius: s.borderRadius !== undefined ? `${s.borderRadius}px` : "50%",
                background: bgColor || "#0c2f55",
                color: s.iconColor || color || "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: s.iconSize || 20,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {item.image || item.iconType === "image" ? (
                <img
                  src={getImageUrl(item.image || "")}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: s.iconSize || 20,
                    height: s.iconSize || 20,
                    objectFit: "contain",
                  }}
                />
              ) : (
                <SocialIconGlyph name={item.icon} size={s.iconSize || 20} />
              )}
            </a>
          ))}
        </div>
      );

    case "audio":
      return widget.url ? (
        <audio
          src={getImageUrl(widget.url)}
          controls={widget.settings?.controls !== false}
          style={{ ...renderStyles(widget.style, device), width: "100%" }}
        />
      ) : null;

    case "blockquote":
      return (
        <blockquote
          style={{
            ...renderStyles(widget.style, device),
            borderLeft: `${Math.max(2, s.borderWidth || 3)}px solid ${s.borderColor || "#2563eb"}`,
            paddingLeft: 20,
            marginLeft: 0,
          }}
        >
          <p style={{ margin: 0 }}>{widget.content}</p>
          {widget.settings?.author && (
            <footer style={{ marginTop: 12, fontWeight: 600 }}>
              — {widget.settings.author}
            </footer>
          )}
        </blockquote>
      );

    case "breadcrumbs":
      return (
        <nav aria-label="Breadcrumb" style={{ ...baseStyle, width: "100%" }}>
          <ol style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {(widget.items || []).map((item, index) => (
              <li key={item.id} style={{ display: "flex", gap: 8 }}>
                {index > 0 && <span aria-hidden="true">/</span>}
                {item.link?.url ? <a href={item.link.url}>{item.title}</a> : <span aria-current="page">{item.title}</span>}
              </li>
            ))}
          </ol>
        </nav>
      );

    case "call_to_action":
      return (
        <section style={{ ...renderStyles(widget.style, device), textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>{widget.settings?.title || "Take the next step"}</h2>
          {widget.settings?.description && <p>{widget.settings.description}</p>}
          <a
            href={widget.url || "#"}
            style={{ display: "inline-block", padding: "12px 24px", borderRadius: 6, background: bgColor || "#0c2f55", color: color || "#fff", textDecoration: "none" }}
          >
            {widget.content || "Get Started"}
          </a>
        </section>
      );

    case "flip_box": {
      const front = widget.items?.[0];
      const back = widget.items?.[1];
      return (
        <details style={{ ...renderStyles(widget.style, device), cursor: "pointer" }}>
          <summary style={{ listStyle: "none", minHeight: 140 }}>
            <strong>{front?.title || "Front"}</strong>
            <p>{front?.content}</p>
            <span>Click to reveal</span>
          </summary>
          <div style={{ paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
            <strong>{back?.title || "Back"}</strong>
            <p>{back?.content}</p>
          </div>
        </details>
      );
    }

    case "price_list":
      return (
        <div style={{ ...renderStyles(widget.style, device), display: "grid", gap: 16 }}>
          {(widget.items || []).map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px dotted #cbd5e1", paddingBottom: 10 }}>
              <div><strong>{item.title}</strong>{item.content && <p style={{ margin: "4px 0 0", color: "#64748b" }}>{item.content}</p>}</div>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
      );

    case "price_table":
      return (
        <section style={{ ...renderStyles(widget.style, device), textAlign: "center", border: "1px solid #e5e7eb" }}>
          <h2 style={{ marginTop: 0 }}>{widget.settings?.title || "Plan"}</h2>
          {widget.settings?.author && <p style={{ fontSize: 24, fontWeight: 700 }}>{widget.settings.author}</p>}
          <p>{widget.content}</p>
          <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
            {(widget.items || []).map((item) => <li key={item.id}>✓ {item.title}</li>)}
          </ul>
          <a href={widget.url || "#"} style={{ display: "inline-block", padding: "10px 20px", background: bgColor || "#0c2f55", color: color || "#fff", borderRadius: 6, textDecoration: "none" }}>Choose Plan</a>
        </section>
      );

    case "share_buttons": {
      const pageUrl = typeof window === "undefined" ? "" : encodeURIComponent(window.location.href);
      const shareTargets: Record<string, string> = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`,
        x: `https://twitter.com/intent/tweet?url=${pageUrl}`,
        twitter: `https://twitter.com/intent/tweet?url=${pageUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`,
        whatsapp: `https://wa.me/?text=${pageUrl}`,
      };
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, ...renderStyles(widget.style, device) }}>
          {(widget.items || []).map((item) => (
            <a key={item.id} href={shareTargets[(item.title || "").toLowerCase()] || item.link?.url || "#"} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 14px", borderRadius: 6, background: bgColor || "#0c2f55", color: color || "#fff", textDecoration: "none" }}>
              {item.title || "Share"}
            </a>
          ))}
        </div>
      );
    }

    case "slides":
      return (
        <div aria-label="Slides" style={{ display: "flex", gap: 16, overflowX: "auto", scrollSnapType: "x mandatory", ...renderStyles(widget.style, device) }}>
          {(widget.items || []).map((item) => (
            <article key={item.id} style={{ flex: "0 0 100%", minHeight: 220, padding: 24, boxSizing: "border-box", scrollSnapAlign: "start", background: item.image ? `linear-gradient(#0005,#0005),url("${getImageUrl(item.image)}") center/cover` : "#f1f5f9", color: item.image ? "#fff" : color }}>
              <h2>{item.title}</h2>
              <p>{item.content}</p>
            </article>
          ))}
        </div>
      );

    case "posts":
    case "post_grid":
    case "loop_grid":
      if (widget.settings?.loopSource === "products") {
        return (
          <ProductLoopWidget
            widget={widget}
            device={device}
            pageId={pageId}
            pageTitle={pageTitle}
          />
        );
      }
      return (
        <PublicPostsWidget
          limit={widget.settings?.postsPerPage || 6}
          columns={widget.settings?.columns || 3}
          layout="grid"
          source={widget.settings?.loopSource === "custom" ? "custom" : "posts"}
          postType={widget.settings?.loopPostType || "posts"}
          categories={widget.settings?.loopCategories}
          tags={widget.settings?.loopTags}
          exclude={widget.settings?.includeExclude === "exclude"}
          orderBy={widget.settings?.loopOrderBy === "title" ? "title" : "date"}
          order={widget.settings?.loopOrder || "DESC"}
          dateRange={widget.settings?.loopDate || "all"}
          pagination={widget.settings?.loopPagination}
        />
      );
    case "post_list":
    case "post_carousel":
      if (widget.settings?.loopSource === "products") {
        return (
          <ProductLoopWidget
            widget={widget}
            device={device}
            pageId={pageId}
            pageTitle={pageTitle}
          />
        );
      }
      return (
        <PublicPostsWidget
          limit={widget.settings?.postsPerPage || 6}
          columns={1}
          layout={widget.type === "post_carousel" ? "carousel" : "list"}
          source={widget.settings?.loopSource === "custom" ? "custom" : "posts"}
          postType={widget.settings?.loopPostType || "posts"}
          categories={widget.settings?.loopCategories}
          tags={widget.settings?.loopTags}
          exclude={widget.settings?.includeExclude === "exclude"}
          orderBy={widget.settings?.loopOrderBy === "title" ? "title" : "date"}
          order={widget.settings?.loopOrder || "DESC"}
          dateRange={widget.settings?.loopDate || "all"}
          pagination={widget.settings?.loopPagination}
        />
      );
    case "loop_carousel":
      if (widget.settings?.loopSource === "products") {
        return (
          <ProductLoopWidget
            widget={widget}
            device={device}
            pageId={pageId}
            pageTitle={pageTitle}
          />
        );
      }
      return (
        <PublicPostsWidget
          limit={widget.settings?.postsPerPage || 6}
          columns={widget.settings?.columns || 3}
          layout="carousel"
          source={widget.settings?.loopSource === "custom" ? "custom" : "posts"}
          postType={widget.settings?.loopPostType || "posts"}
          categories={widget.settings?.loopCategories}
          tags={widget.settings?.loopTags}
          exclude={widget.settings?.includeExclude === "exclude"}
          orderBy={widget.settings?.loopOrderBy === "title" ? "title" : "date"}
          order={widget.settings?.loopOrder || "DESC"}
          dateRange={widget.settings?.loopDate || "all"}
          pagination={widget.settings?.loopPagination}
        />
      );

    default:
      return null;
  }
  };

  const renderedContent = renderWidgetContent();
  const cssId = String((widget.style as any).cssId || "").trim();
  return cssId ? (
    <div id={cssId} style={{ display: "contents" }}>{renderedContent}</div>
  ) : renderedContent;
};

// ============ MAIN RENDERER ============
const BuilderRenderer = ({
  layout,
  device = "desktop",
  pageId = "homepage",
  pageTitle = "",
  product,
}: BuilderRendererProps) => {
  const safeLayout = useMemo(() => {
    if (Array.isArray(layout)) return layout;
    if (layout === null || layout === undefined) return [];
    console.warn(
      "BuilderRenderer: layout is not an array. Received:",
      typeof layout,
      layout,
    );
    return [];
  }, [layout]);

  useEffect(() => {
    const collectFonts = (widgets: PageWidget[]) => {
      widgets.forEach((widget) => {
        loadGoogleFont(widget.style?.fontFamily);
        Object.values(widget.style?.responsive || {}).forEach((style) =>
          loadGoogleFont(style?.fontFamily),
        );
        if (Array.isArray(widget.children)) collectFonts(widget.children);
      });
    };
    collectFonts(safeLayout);
  }, [safeLayout]);

  if (!safeLayout.length) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
        No content
      </div>
    );
  }

  return (
    <div className="builder-renderer">
      {safeLayout.map((widget) => (
        <WidgetRenderer
          key={widget.id}
          widget={widget}
          device={device}
          pageId={pageId}
          pageTitle={pageTitle}
          product={product}
          isRoot
        />
      ))}
    </div>
  );
};

export default BuilderRenderer;
