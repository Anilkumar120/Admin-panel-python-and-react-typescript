import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { API_URL, getImageUrl } from "../../api/config";
import type { PageWidget, ResponsiveDevice } from "../../types/pageBuilder";
import { submitForm } from "../../api/forms";
import { addToCart } from "../../api/cart";
import { getPublicMenu } from "../../api/menus";
import BuilderIcon from "../BuilderIcon";

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
            <strong style={{ color: "#0c2f55" }}>
              ₹{Number(product.price || 0).toFixed(2)}
            </strong>
          </div>
        </a>
      ))}
    </div>
  );
};

const PublicPostsWidget = ({
  limit,
  columns,
  layout,
}: {
  limit: number;
  columns: number;
  layout: "grid" | "list";
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

  useEffect(() => {
    let active = true;
    axios
      .get<{ posts: typeof posts }>(`${API_URL}/api/public/posts`, {
        params: { page: 1, limit },
      })
      .then(({ data }) => {
        if (active) setPosts(Array.isArray(data.posts) ? data.posts : []);
      })
      .catch((loadError) => {
        console.error("PUBLIC POST WIDGET LOAD ERROR:", loadError);
        if (active) setError("Posts could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [limit]);

  if (error) return <p role="alert">{error}</p>;
  if (!posts.length) return <p>No published posts yet.</p>;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          layout === "grid"
            ? `repeat(auto-fit, minmax(min(100%, ${Math.max(180, Math.floor(1200 / Math.max(1, columns)))}px), 1fr))`
            : "1fr",
        gap: 20,
      }}
    >
      {posts.map((post) => (
        <a
          key={post.id}
          href={post.permalink || `/${post.slug}`}
          style={{
            display: layout === "list" ? "flex" : "block",
            gap: 16,
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
  );
};

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
}: {
  items: NonNullable<PageWidget["items"]>;
  widgetId: string;
  color: string;
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
        {activeItem.content}
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
      <label style={{ display: "block", marginBottom: 12 }}>
        <span>Name</span>
        <input
          type="text"
          name="name"
          autoComplete="name"
          required
          maxLength={200}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 4,
            border: "1px solid #ddd",
            borderRadius: 6,
            boxSizing: "border-box",
          }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={320}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 4,
            border: "1px solid #ddd",
            borderRadius: 6,
            boxSizing: "border-box",
          }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span>Message</span>
        <textarea
          name="message"
          rows={4}
          required
          maxLength={5000}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 4,
            border: "1px solid #ddd",
            borderRadius: 6,
            boxSizing: "border-box",
          }}
        />
      </label>
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
  const hasHover =
    style?.hoverBackgroundColor ||
    style?.hoverColor ||
    style?.hoverBorderColor ||
    style?.hoverBoxShadow ||
    (style?.hoverScale && style.hoverScale !== 1) ||
    (style?.hoverOpacity !== undefined && style.hoverOpacity !== 1) ||
    style?.hoverTranslateY;

  const hasAnimation = style?.animation && style.animation !== "none";

  if (!hasHover && !hasAnimation) {
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

    if (style.hoverBackgroundColor)
      hoverRules.push(
        `background-color: ${style.hoverBackgroundColor} !important;`,
      );
    if (style.hoverColor)
      hoverRules.push(`color: ${style.hoverColor} !important;`);
    if (style.hoverBorderColor)
      hoverRules.push(`border-color: ${style.hoverBorderColor} !important;`);
    if (style.hoverBoxShadow)
      hoverRules.push(`box-shadow: ${style.hoverBoxShadow} !important;`);

    const transforms: string[] = [];
    if (style.hoverScale && style.hoverScale !== 1)
      transforms.push(`scale(${style.hoverScale})`);
    if (style.hoverTranslateY)
      transforms.push(`translateY(${style.hoverTranslateY}px)`);
    if (transforms.length)
      hoverRules.push(`transform: ${transforms.join(" ")} !important;`);

    if (style.hoverOpacity !== undefined && style.hoverOpacity !== 1)
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
  const rs = style?.responsive?.[device] || {};

  const getSpacing = (responsiveValue: any, baseValue: any) => {
    const value = responsiveValue ?? baseValue;

    if (!value || typeof value !== "object") {
      return undefined;
    }

    return `${value.top ?? 0}px ${value.right ?? 0}px ${
      value.bottom ?? 0
    }px ${value.left ?? 0}px`;
  };

  const normalizeSize = (value: unknown): string | undefined => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return `${value}px`;
    }

    const text = String(value).trim();

    if (!text) return undefined;

    return /^-?\d*\.?\d+$/.test(text) ? `${text}px` : text;
  };

  const display = rs.display ?? style.display;
  const flexDirection = rs.flexDirection ?? style.flexDirection;

  const isFlexOrGrid = display === "flex" || display === "grid";

  const gap = normalizeSize(rs.gap ?? style.gap);
  const rowGap = normalizeSize(rs.rowGap ?? style.rowGap);
  const columnGap = normalizeSize(rs.columnGap ?? style.columnGap);

  return {
    boxSizing: "border-box",

    backgroundColor: rs.backgroundColor ?? style.backgroundColor,

    backgroundImage: style.backgroundImage
      ? `url("${getImageUrl(style.backgroundImage)}")`
      : style.backgroundGradient || undefined,

    backgroundSize: style.backgroundSize || "cover",
    backgroundPosition: style.backgroundPosition || "center",
    backgroundRepeat: style.backgroundRepeat || "no-repeat",

    color: rs.color ?? style.color,

    fontSize: normalizeSize(rs.fontSize ?? style.fontSize),
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,

    letterSpacing:
      style.letterSpacing !== undefined
        ? normalizeSize(style.letterSpacing)
        : undefined,

    textAlign: rs.textAlign ?? style.textAlign,
    textTransform: style.textTransform,
    textDecoration: style.textDecoration,
    textShadow: style.textShadow,

    width: style.width,
    height: style.height,
    minWidth: style.minWidth,
    maxWidth: "100%", // ✅ FIX: Public view box break nahi hoga
    minHeight: style.minHeight,
    maxHeight: style.maxHeight,

    padding: getSpacing(rs.padding, style.padding),
    margin: getSpacing(rs.margin, style.margin),

    borderColor: style.borderColor,
    borderWidth: normalizeSize(style.borderWidth),
    borderStyle: style.borderStyle,
    borderRadius: normalizeSize(style.borderRadius),
    boxShadow: style.boxShadow,

    opacity: style.opacity,
    position: style.position,
    top: style.top,
    right: style.right,
    bottom: style.bottom,
    left: style.left,
    zIndex: style.zIndex,
    overflow: "hidden", // ✅ FIX: Bahar nahi jayega

    display,
    flexDirection: flexDirection as React.CSSProperties["flexDirection"],
    flexWrap: rs.flexWrap ?? style.flexWrap,

    justifyContent: rs.justifyContent ?? style.justifyContent,
    alignItems: rs.alignItems ?? style.alignItems,
    alignContent: rs.alignContent ?? style.alignContent,

    // Apply saved layout gap to the public renderer.
    gap: gap ?? (isFlexOrGrid ? "20px" : undefined),

    rowGap: rowGap ?? gap ?? (isFlexOrGrid ? "20px" : undefined),

    columnGap: columnGap ?? gap ?? (isFlexOrGrid ? "20px" : undefined),

    gridTemplateColumns:
      rs.gridTemplateColumns ??
      style.gridTemplateColumns ??
      (style.gridColumns ? `repeat(${style.gridColumns}, 1fr)` : undefined),

    gridTemplateRows:
      rs.gridTemplateRows ??
      style.gridTemplateRows ??
      (style.gridRows ? `repeat(${style.gridRows}, 1fr)` : undefined),
  };
};

// ============ LINK WRAPPER ============
const MaybeLink = ({
  widget,
  children,
}: {
  widget: PageWidget;
  children: React.ReactNode;
}) => {
  const linkUrl = widget.link?.url || widget.url;
  if (!linkUrl || linkUrl === "#") return <>{children}</>;

  return (
    <a
      href={linkUrl}
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
          className={`${uid}-toggle`}
          aria-label="Toggle menu"
          onClick={(e) => {
            e.stopPropagation();
            document.querySelector(`.${uid}-list`)?.classList.toggle("open");
            document
              .querySelector(`.${uid}-backdrop`)
              ?.classList.toggle("open");
          }}
        >
          <span />
        </button>
        <ul className={`${uid}-list nav-menu-widget`}>
          {items.map((item) => renderMenuItem(item, 0))}
        </ul>
        <div
          className={`${uid}-backdrop`}
          onClick={(e) => {
            e.stopPropagation();
            document.querySelector(`.${uid}-list`)?.classList.remove("open");
            document
              .querySelector(`.${uid}-backdrop`)
              ?.classList.remove("open");
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
  const linkUrl = widget.link?.url || "/";

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (widget.link?.target === "_blank" || !linkUrl.startsWith("/")) return;
    e.preventDefault();
    navigate(linkUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <StyleInjector css={hover.cssText} />
      <a
        href={linkUrl}
        target={widget.link?.target || "_self"}
        rel={
          widget.link?.noFollow
            ? "nofollow noopener"
            : widget.link?.target === "_blank"
              ? "noopener noreferrer"
              : undefined
        }
        onClick={handleClick}
        className={`site-logo-widget ${hover.className}`.trim()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          textDecoration: "none",
          width: "auto",
          cursor: "pointer",
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
}: {
  widget: PageWidget;
  device: ResponsiveDevice;
  pageId: string;
  pageTitle: string;
  product?: ProductData;
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

  const isContainer = ["container", "section", "column", "grid"].includes(
    widget.type,
  );

  if (isContainer) {
    const styles = renderStyles(widget.style, device);

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

    return (
      <div
        style={styles}
        className={`public-widget public-widget-${widget.type} ${layoutClass}`}
        data-widget-type={widget.type}
        data-widget-id={widget.id}
      >
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
      </div>
    );
  }

  switch (widget.type) {
    case "product_title":
      return <div style={baseStyle}>{product?.title || "Product Title"}</div>;

    case "product_price":
      return (
        <div style={{ ...baseStyle, fontWeight: 700 }}>
          {product
            ? `₹${Number(product.price || 0).toFixed(2)}`
            : "Product Price"}
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
            <div style={{ width: "100%", textAlign: headingTextAlign }}>
              <HeadingTag
                className={hover.className}
                style={{
                  ...baseStyle,
                  textAlign: headingTextAlign,
                  margin: 0,
                  padding: 0,
                  display: "block",
                  width: s.width || undefined,
                  maxWidth: s.maxWidth || undefined,
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
                width: "100%",
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
      const hover = getHoverAndAnimation(s, widget.id);

      return (
        <>
          <StyleInjector css={hover.cssText} />
          <div style={{ textAlign: btnTextAlign, width: "100%" }}>
            <a
              href={widget.link?.url || widget.url || "#"}
              target={widget.link?.target || "_self"}
              className={hover.className}
              style={{
                ...baseStyle,
                textAlign: btnTextAlign,
                backgroundColor: bgColor || "#0c2f55",
                color: rs.color || s.color || "#ffffff",
                padding: "12px 24px",
                borderRadius: s.borderRadius ? `${s.borderRadius}px` : "6px",
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

      return (
        <>
          <StyleInjector css={hover.cssText} />
          <MaybeLink widget={widget}>
            <img
              src={getImageUrl(widget.url)}
              alt={widget.accessibility?.altText || widget.label}
              className={hover.className}
              style={{
                width: s.width || "100%",
                height: s.height || "auto",
                minWidth: s.minWidth,
                maxWidth: s.maxWidth || "100%",
                minHeight: s.minHeight,
                maxHeight: s.maxHeight,
                display: "block",
                borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
                objectFit: (s.objectFit as any) || "cover",
                objectPosition: s.objectPosition || "center",
                boxShadow: s.boxShadow,
              }}
            />
          </MaybeLink>
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
            flexDirection: (s.flexDirection as "row" | "column") || "column",
            gap: `${s.gap ?? 12}px`,
            padding: 0,
            margin: 0,
          }}
        >
          {(widget.items || []).map((item) => {
            const itemContent = (
              <>
                {item.image ? (
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
                  <BuilderIcon
                    name={item.icon}
                    style={{
                      color: s.iconColor || color || "#0c2f55",
                      fontSize: `${s.iconSize || 20}px`,
                      lineHeight: 1,
                    }}
                  />
                )}
                <span>{item.title || item.content}</span>
              </>
            );

            return (
              <li key={item.id}>
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

    case "icon":
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
            ) : (
              widget.content || "★"
            )}
          </div>
        </MaybeLink>
      );

    case "icon_box":
      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              textAlign: "center",
              padding: 24,
              color,
              backgroundColor: bgColor,
              borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
            }}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: 16,
                color: color || "#0c2f55",
              }}
            >
              {widget.content || "★"}
            </div>
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
        </MaybeLink>
      );

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
      return <div style={{ minHeight: `${s.padding?.top || 40}px` }} />;

    case "divider":
      return (
        <hr
          style={{
            borderColor: s.borderColor || "#e0e0e0",
            borderWidth: `${s.borderWidth || 1}px`,
            borderStyle: s.borderStyle || "solid",
            margin: "16px 0",
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
      const headers = widget.settings?.tableHeaders || ["Name", "Role"];
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
              <div
                style={{ padding: "12px 16px", color: "#666", fontSize: 14 }}
              >
                {item.content}
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
        />
      );

    case "testimonial":
      return (
        <div
          style={{
            background: bgColor || "#f8f9fc",
            padding: 32,
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, color: "#f0b429", marginBottom: 12 }}>
            ★★★★★
          </div>
          <p
            style={{
              fontStyle: "italic",
              color: "#444",
              marginBottom: 16,
              fontSize: 15,
            }}
          >
            "{widget.items?.[0]?.content}"
          </p>
          <div style={{ fontWeight: 700 }}>{widget.items?.[0]?.title}</div>
        </div>
      );

    case "counter":
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
            {widget.items?.[0]?.content ||
              widget.settings?.items?.[0]?.content ||
              "1000"}
          </div>
          <div style={{ color, marginTop: 12, fontSize: 15, opacity: 0.75 }}>
            {widget.items?.[0]?.title ||
              widget.settings?.items?.[0]?.title ||
              "Happy Clients"}
          </div>
        </div>
      );

    case "progress_bar":
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
            <span style={{ fontWeight: 600 }}>
              {widget.items?.[0]?.title || "Progress"}
            </span>
            <span>{widget.items?.[0]?.content || "80"}%</span>
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
                width: `${widget.items?.[0]?.content || 80}%`,
                height: "100%",
                background: color || "#0c2f55",
                borderRadius: 6,
              }}
            />
          </div>
        </div>
      );

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

    case "social_icons":
      return (
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
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
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: bgColor || "#0c2f55",
                color: color || "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {(item.icon || item.title || "•").slice(0, 2)}
            </a>
          ))}
        </div>
      );

    case "posts":
    case "post_grid":
      return (
        <PublicPostsWidget
          limit={widget.settings?.postsPerPage || 6}
          columns={widget.settings?.columns || 3}
          layout="grid"
        />
      );
    case "post_list":
    case "post_carousel":
      return (
        <PublicPostsWidget
          limit={widget.settings?.postsPerPage || 6}
          columns={1}
          layout="list"
        />
      );

    default:
      return null;
  }
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
        />
      ))}
    </div>
  );
};

export default BuilderRenderer;