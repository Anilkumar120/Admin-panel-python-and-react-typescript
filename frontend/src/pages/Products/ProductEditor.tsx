import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  createProduct,
  getProduct,
  updateProduct,
  type Product,
} from "../../api/products";
import { getPublicPermalinkSettings } from "../../api/settings";
import { getMediaUrl } from "../../api/media";
import { API_URL } from "../../api/config";
import MediaPicker, { type PickedMedia } from "../admin/MediaPicker";
import "./ProductEditor.css";

type ProductTab =
  | "general"
  | "inventory"
  | "shipping"
  | "linked"
  | "attributes"
  | "variations"
  | "advanced";

type ProductDraft = Partial<Product> & {
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
  brand: string;
  gallery: { media_id?: string; url: string; alt?: string }[];
  tags: string[];
  attributes: NonNullable<Product["attributes"]>;
  variations: NonNullable<Product["variations"]>;
  dimensions: NonNullable<Product["dimensions"]>;
  upsells: string[];
  cross_sells: string[];
};

type TermOptions = {
  categories: string[];
  tags: string[];
  brands: string[];
  attributes: string[];
};

const safeList = <T,>(value: T[] | undefined | null): T[] => value ?? [];

/* FIX: Convert FastAPI validation errors into readable strings. */
const getProductErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return "Unable to save this product. Please try again.";
  }

  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item: unknown) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          const validation = item as {
            loc?: unknown[];
            msg?: unknown;
          };

          const location = Array.isArray(validation.loc)
            ? validation.loc.map(String).join(".")
            : "";

          const message =
            typeof validation.msg === "string"
              ? validation.msg
              : JSON.stringify(item);

          return location ? `${location}: ${message}` : message;
        }

        return String(item);
      })
      .join("; ");
  }

  if (detail && typeof detail === "object") {
    const validation = detail as { msg?: unknown };

    if (typeof validation.msg === "string") {
      return validation.msg;
    }
  }

  return error.response?.status
    ? `Unable to save product. HTTP ${error.response.status}.`
    : "Unable to save this product. Please try again.";
};

const emptyDraft = (): ProductDraft => ({
  name: "",
  description: "",
  price: 0,
  quantity: 0,
  category: "",
  brand: "",
  short_description: "",
  regular_price: 0,
  sale_price: undefined,
  sale_start: "",
  sale_end: "",
  sku: "",
  barcode: "",
  product_type: "simple",
  status: "published",
  visibility: "visible",
  stock_status: "in_stock",
  manage_stock: true,
  allow_backorders: false,
  sold_individually: false,
  low_stock_threshold: 2,
  min_quantity: 1,
  max_quantity: 0,
  quantity_step: 1,
  weight: 0,
  dimensions: {},
  shipping_class: "",
  tags: [],
  gallery: [],
  attributes: [],
  variations: [],
  upsells: [],
  cross_sells: [],
  purchase_note: "",
  menu_order: 0,
  reviews_enabled: true,
});

const emptyTermOptions = (): TermOptions => ({
  categories: [],
  tags: [],
  brands: [],
  attributes: [],
});

const TABS: { id: ProductTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "inventory", label: "Inventory" },
  { id: "shipping", label: "Shipping" },
  { id: "linked", label: "Linked Products" },
  { id: "attributes", label: "Attributes" },
  { id: "variations", label: "Variations" },
  { id: "advanced", label: "Advanced" },
];

const ProductEditor = ({ edit = false }: { edit?: boolean }) => {
  const navigate = useNavigate();
  const { productId } = useParams();

  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [productBase, setProductBase] = useState("products");
  const [featured, setFeatured] = useState<PickedMedia | null>(null);
  const [mediaPicker, setMediaPicker] = useState<
    "featured" | "gallery" | null
  >(null);
  const [tab, setTab] = useState<ProductTab>("general");
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [termOptions, setTermOptions] =
    useState<TermOptions>(emptyTermOptions);

  const update = <K extends keyof ProductDraft>(
    key: K,
    value: ProductDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    getPublicPermalinkSettings()
      .then((settings) =>
        setProductBase(settings.product_base || "products"),
      )
      .catch((loadError) => {
        console.error("PRODUCT PERMALINK SETTINGS ERROR:", loadError);
      });
  }, []);

  useEffect(() => {
    let active = true;

    const token = localStorage.getItem("access_token");
    const headers = { Authorization: `Bearer ${token || ""}` };

    Promise.all(
      (["categories", "tags", "brands", "attributes"] as const).map(
        async (type): Promise<[keyof TermOptions, string[]]> => {
          try {
            const response = await axios.get<{
              terms: { name: string }[];
            }>(`${API_URL}/api/product-taxonomies/${type}`, { headers });

            return [
              type,
              safeList(response.data?.terms).map((term) => term.name),
            ];
          } catch (loadError) {
            console.error(`Unable to load product ${type}:`, loadError);
            return [type, []];
          }
        },
      ),
    ).then((entries) => {
      if (!active) return;

      const merged: TermOptions = emptyTermOptions();

      for (const [type, list] of entries) {
        merged[type] = list;
      }

      setTermOptions(merged);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!edit || !productId) return;

    let active = true;

    getProduct(productId)
      .then((product) => {
        if (!active) return;

        setDraft({
          ...emptyDraft(),
          ...product,
          gallery: safeList(product.gallery).map((image) => ({
            ...image,
            url: getMediaUrl(image.url),
          })),
          tags: safeList(product.tags),
          attributes: safeList(product.attributes),
          variations: safeList(product.variations),
          dimensions: product.dimensions || {},
          upsells: safeList(product.upsells),
          cross_sells: safeList(product.cross_sells),
          regular_price: product.regular_price ?? product.price,
        });

        setSlugManuallyEdited(false);

        const imageUrl = product.image || "";

        if (imageUrl) {
          setFeatured({
            id: product.media_id || "",
            url: getMediaUrl(imageUrl),
            alt: product.name,
            title: product.name,
            fileName: imageUrl.split("/").pop() || product.name,
            mimeType: "image",
          });
        }
      })
      .catch((loadError) => {
        console.error("PRODUCT LOAD ERROR:", loadError);

        if (active) {
          setError("Unable to load product. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [edit, productId]);

  const handleMediaSelect = (selection: PickedMedia | PickedMedia[]) => {
    const media = Array.isArray(selection) ? selection : [selection];

    if (mediaPicker === "featured") {
      setFeatured(media[0] || null);
    } else {
      const combined = [
        ...safeList(draft.gallery),
        ...media.map((item) => ({
          media_id: item.id,
          url: item.url,
          alt: item.alt,
        })),
      ];

      const seen = new Set<string>();

      update(
        "gallery",
        combined.filter((item) => {
          if (!item.media_id) return true;
          if (seen.has(item.media_id)) return false;

          seen.add(item.media_id);
          return true;
        }),
      );
    }

    setMediaPicker(null);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError("");
    setSaving(true);

    const productData: Partial<Product> = {
      ...draft,
      price: Number(draft.regular_price ?? draft.price ?? 0),
      quantity: Number(draft.quantity || 0),
      sale_price: draft.sale_price ?? null,
      media_id: featured?.id || undefined,
      image: featured?.url || "",
    };

    try {
      if (edit && productId) {
        await updateProduct(
          productId,
          draft.name,
          draft.description,
          Number(draft.regular_price ?? draft.price ?? 0),
          Number(draft.quantity || 0),
          draft.category,
          draft.brand,
          featured?.id || undefined,
          productData,
        );
      } else {
        await createProduct(
          draft.name,
          draft.description,
          Number(draft.regular_price ?? draft.price ?? 0),
          Number(draft.quantity || 0),
          draft.category,
          draft.brand,
          featured?.id || "",
          productData,
        );
      }

      navigate("/admin/products");
    } catch (saveError: unknown) {
      console.error("PRODUCT SAVE ERROR:", saveError);

      /* FIX: React now receives a string instead of an error object. */
      setError(getProductErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof ProductDraft,
    options: {
      type?: string;
      required?: boolean;
      placeholder?: string;
      min?: number;
      step?: number;
    } = {},
  ) => (
    <label className="product-editor-field">
      <span>{label}</span>
      <input
        type={options.type || "text"}
        value={String(draft[key] ?? "")}
        required={options.required}
        placeholder={options.placeholder}
        min={options.min}
        step={options.step}
        onChange={(event) => {
          const value =
            options.type === "number"
              ? event.target.value === ""
                ? undefined
                : Number(event.target.value)
              : event.target.value;

          update(key, value as ProductDraft[typeof key]);

          if (key === "name" && !slugManuallyEdited) {
            update(
              "slug",
              String(value)
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, ""),
            );
          }

          if (key === "slug") {
            setSlugManuallyEdited(Boolean(value));
          }
        }}
      />
    </label>
  );

  if (loading) {
    return (
      <div className="products-page">
        <div className="table-card">Loading product...</div>
      </div>
    );
  }

  return (
    <div className="products-page product-editor-page">
      <div className="page-heading">
        <div>
          <h1>{edit ? "Edit Product" : "Add New Product"}</h1>
          <p>
            Manage product data, inventory, images, and storefront visibility.
          </p>
        </div>
      </div>

      {error && (
        <div className="table-error" role="alert">
          {error}
        </div>
      )}

      <form className="product-editor-layout" onSubmit={handleSubmit}>
        <main className="product-editor-main">
          <div className="product-editor-title-card">
            {field("Product name", "name", {
              required: true,
              placeholder: "Product name",
            })}

            {field("Slug", "slug", {
              placeholder: "Generated from product name if left empty",
            })}

            {draft.slug && (
              <small className="product-editor-permalink">
                {window.location.origin}/{productBase}/{draft.slug}
              </small>
            )}

            <label className="product-editor-field">
              <span>Full description</span>
              <textarea
                rows={6}
                value={draft.description}
                onChange={(event) =>
                  update("description", event.target.value)
                }
                placeholder="Describe the product"
              />
            </label>
          </div>

          <section className="product-editor-panel">
            <nav
              className="product-editor-tabs"
              aria-label="Product data sections"
            >
              {TABS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={tab === item.id ? "active" : ""}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="product-editor-tab-content">
              {tab === "general" && (
                <>
                  <div className="product-editor-row">
                    <label className="product-editor-field">
                      <span>Product type</span>
                      <select
                        value={draft.product_type}
                        onChange={(event) =>
                          update(
                            "product_type",
                            event.target.value as Product["product_type"],
                          )
                        }
                      >
                        <option value="simple">Simple product</option>
                        <option value="variable">Variable product</option>
                        <option value="grouped">Grouped product</option>
                        <option value="external">External / affiliate</option>
                      </select>
                    </label>

                    {field("Regular price (₹)", "regular_price", {
                      type: "number",
                      min: 0,
                      step: 0.01,
                    })}

                    {field("Sale price (₹)", "sale_price", {
                      type: "number",
                      min: 0,
                      step: 0.01,
                    })}
                  </div>

                  <div className="product-editor-row">
                    {field("Sale starts", "sale_start", {
                      type: "datetime-local",
                    })}

                    {field("Sale ends", "sale_end", {
                      type: "datetime-local",
                    })}

                    {field("Purchase cost (admin only)", "purchase_cost", {
                      type: "number",
                      min: 0,
                      step: 0.01,
                    })}
                  </div>

                  {draft.product_type === "external" && (
                    <div className="product-editor-row">
                      {field("Product URL", "external_url", {
                        type: "url",
                        placeholder: "https://",
                      })}

                      {field("Button text", "button_text", {
                        placeholder: "Buy product",
                      })}
                    </div>
                  )}
                </>
              )}

              {tab === "inventory" && (
                <>
                  <div className="product-editor-row">
                    {field("SKU", "sku")}
                    {field("Barcode (EAN / UPC / ISBN)", "barcode")}

                    {field("Stock quantity", "quantity", {
                      type: "number",
                      min: 0,
                    })}
                  </div>

                  <div className="product-editor-row">
                    <label className="product-editor-field">
                      <span>Stock status</span>
                      <select
                        value={draft.stock_status}
                        onChange={(event) =>
                          update(
                            "stock_status",
                            event.target.value as Product["stock_status"],
                          )
                        }
                      >
                        <option value="in_stock">In stock</option>
                        <option value="out_of_stock">Out of stock</option>
                        <option value="backorder">On backorder</option>
                      </select>
                    </label>

                    {field("Low stock threshold", "low_stock_threshold", {
                      type: "number",
                      min: 0,
                    })}

                    {field("Minimum quantity", "min_quantity", {
                      type: "number",
                      min: 1,
                    })}

                    {field("Maximum quantity (0 = unlimited)", "max_quantity", {
                      type: "number",
                      min: 0,
                    })}

                    {field("Quantity step", "quantity_step", {
                      type: "number",
                      min: 1,
                    })}
                  </div>

                  <div className="product-editor-checks">
                    {(
                      [
                        ["manage_stock", "Manage stock"],
                        ["allow_backorders", "Allow backorders"],
                        ["sold_individually", "Sold individually"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={Boolean(draft[key])}
                          onChange={(event) =>
                            update(key, event.target.checked)
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {tab === "shipping" && (
                <>
                  <div className="product-editor-row">
                    {field("Weight", "weight", {
                      type: "number",
                      min: 0,
                      step: 0.01,
                    })}

                    {(["length", "width", "height"] as const).map(
                      (dimension) => (
                        <label className="product-editor-field" key={dimension}>
                          <span>
                            {dimension[0].toUpperCase() + dimension.slice(1)}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={draft.dimensions[dimension] ?? ""}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                dimensions: {
                                  ...current.dimensions,
                                  [dimension]: Number(event.target.value),
                                },
                              }))
                            }
                          />
                        </label>
                      ),
                    )}

                    {field("Shipping class", "shipping_class")}
                  </div>

                  <div className="product-editor-checks">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.virtual)}
                        onChange={(event) =>
                          update("virtual", event.target.checked)
                        }
                      />
                      Virtual product
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.downloadable)}
                        onChange={(event) =>
                          update("downloadable", event.target.checked)
                        }
                      />
                      Downloadable product
                    </label>
                  </div>

                  {Boolean(draft.downloadable) && (
                    <div className="product-editor-row">
                      {field("Download limit (0 = unlimited)", "download_limit", {
                        type: "number",
                        min: 0,
                      })}

                      {field(
                        "Download expiry (days, 0 = never)",
                        "download_expiry",
                        { type: "number", min: 0 },
                      )}
                    </div>
                  )}
                </>
              )}

              {tab === "linked" && (
                <div className="product-editor-row">
                  <label className="product-editor-field">
                    <span>Upsell product IDs (comma separated)</span>
                    <input
                      value={safeList(draft.upsells).join(", ")}
                      onChange={(event) =>
                        update(
                          "upsells",
                          event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="Product IDs"
                    />
                  </label>

                  <label className="product-editor-field">
                    <span>Cross-sell product IDs (comma separated)</span>
                    <input
                      value={safeList(draft.cross_sells).join(", ")}
                      onChange={(event) =>
                        update(
                          "cross_sells",
                          event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="Product IDs"
                    />
                  </label>

                  <small>
                    Enter product IDs for related, upsell, and cross-sell
                    recommendations.
                  </small>
                </div>
              )}

              {tab === "attributes" && (
                <div className="product-editor-rows">
                  {safeList(draft.attributes).map((attribute, index) => (
                    <div
                      className="product-editor-attribute"
                      key={`${attribute.name}-${index}`}
                    >
                      <input
                        aria-label="Attribute name"
                        list="product-attribute-options"
                        placeholder="Attribute name"
                        value={attribute.name}
                        onChange={(event) =>
                          update(
                            "attributes",
                            safeList(draft.attributes).map((item, i) =>
                              i === index
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />

                      <input
                        aria-label="Attribute values"
                        placeholder="Values, comma separated"
                        value={safeList(attribute.options).join(", ")}
                        onChange={(event) =>
                          update(
                            "attributes",
                            safeList(draft.attributes).map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    options: event.target.value
                                      .split(",")
                                      .map((value) => value.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          )
                        }
                      />

                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(attribute.visible)}
                          onChange={(event) =>
                            update(
                              "attributes",
                              safeList(draft.attributes).map((item, i) =>
                                i === index
                                  ? { ...item, visible: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        Visible
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(attribute.variation)}
                          onChange={(event) =>
                            update(
                              "attributes",
                              safeList(draft.attributes).map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      variation: event.target.checked,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        Used for variations
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          update(
                            "attributes",
                            safeList(draft.attributes).filter(
                              (_, i) => i !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      update("attributes", [
                        ...safeList(draft.attributes),
                        {
                          name: "",
                          options: [],
                          visible: true,
                          variation: false,
                        },
                      ])
                    }
                  >
                    Add attribute
                  </button>
                </div>
              )}

              {tab === "variations" && (
                <div className="product-editor-rows">
                  {draft.product_type !== "variable" && (
                    <p>
                      Choose Variable product above to configure variations.
                    </p>
                  )}

                  {draft.product_type === "variable" &&
                    safeList(draft.variations).map((variation, index) => (
                      <div className="product-editor-variation" key={index}>
                        <input
                          placeholder="Variation SKU"
                          value={variation.sku || ""}
                          onChange={(event) =>
                            update(
                              "variations",
                              safeList(draft.variations).map((item, i) =>
                                i === index
                                  ? { ...item, sku: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />

                        <input
                          placeholder="Attributes (e.g. Color=Blue)"
                          value={Object.entries(variation.attributes || {})
                            .map(([name, value]) => `${name}=${value}`)
                            .join(", ")}
                          onChange={(event) => {
                            const attributes = Object.fromEntries(
                              event.target.value
                                .split(",")
                                .map((part) => part.trim().split("="))
                                .filter((part) => part.length === 2),
                            );

                            update(
                              "variations",
                              safeList(draft.variations).map((item, i) =>
                                i === index ? { ...item, attributes } : item,
                              ),
                            );
                          }}
                        />

                        <input
                          aria-label="Variation price"
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Price"
                          value={variation.price ?? ""}
                          onChange={(event) =>
                            update(
                              "variations",
                              safeList(draft.variations).map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      price: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />

                        <input
                          aria-label="Variation stock"
                          type="number"
                          min={0}
                          placeholder="Stock"
                          value={variation.quantity ?? ""}
                          onChange={(event) =>
                            update(
                              "variations",
                              safeList(draft.variations).map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      quantity: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            update(
                              "variations",
                              safeList(draft.variations).filter(
                                (_, i) => i !== index,
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                  {draft.product_type === "variable" && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        update("variations", [
                          ...safeList(draft.variations),
                          {
                            sku: "",
                            attributes: {},
                            price: Number(draft.regular_price || 0),
                            quantity: 0,
                            enabled: true,
                          },
                        ])
                      }
                    >
                      Add variation
                    </button>
                  )}
                </div>
              )}

              {tab === "advanced" && (
                <>
                  <label className="product-editor-field">
                    <span>Purchase note</span>
                    <textarea
                      rows={3}
                      value={draft.purchase_note || ""}
                      onChange={(event) =>
                        update("purchase_note", event.target.value)
                      }
                    />
                  </label>

                  <div className="product-editor-row">
                    {field("Menu order", "menu_order", { type: "number" })}
                    {field("Tax class", "tax_class")}
                  </div>

                  <label className="product-editor-checks">
                    <input
                      type="checkbox"
                      checked={draft.reviews_enabled !== false}
                      onChange={(event) =>
                        update("reviews_enabled", event.target.checked)
                      }
                    />
                    Enable product reviews
                  </label>
                </>
              )}
            </div>
          </section>

          <label className="product-editor-field">
            <span>Short description</span>
            <textarea
              rows={4}
              value={draft.short_description || ""}
              onChange={(event) =>
                update("short_description", event.target.value)
              }
            />
          </label>

          <div className="product-editor-footer-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : edit
                  ? "Update Product"
                  : "Publish Product"}
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={() => navigate("/admin/products")}
            >
              Cancel
            </button>
          </div>
        </main>

        <aside className="product-editor-sidebar">
          <section className="product-editor-panel">
            <h2>Publish</h2>

            <label className="product-editor-field">
              <span>Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  update("status", event.target.value as Product["status"])
                }
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="private">Private</option>
              </select>
            </label>

            <label className="product-editor-field">
              <span>Catalog visibility</span>
              <select
                value={draft.visibility}
                onChange={(event) =>
                  update(
                    "visibility",
                    event.target.value as Product["visibility"],
                  )
                }
              >
                <option value="visible">Shop and search</option>
                <option value="catalog">Shop only</option>
                <option value="search">Search only</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>

            <label className="product-editor-field">
              <span>Publish date</span>
              <input
                type="datetime-local"
                value={draft.publish_date || ""}
                onChange={(event) =>
                  update("publish_date", event.target.value)
                }
              />
            </label>
          </section>

          <section className="product-editor-panel">
            <h2>Product image</h2>

            {featured && (
              <img
                className="product-featured-preview"
                src={featured.url}
                alt={featured.alt}
              />
            )}

            <button
              type="button"
              className="secondary-button"
              onClick={() => setMediaPicker("featured")}
            >
              {featured ? "Replace image" : "Set product image"}
            </button>

            {featured && (
              <button
                type="button"
                className="product-remove-link"
                onClick={() => setFeatured(null)}
              >
                Remove image
              </button>
            )}
          </section>

          <section className="product-editor-panel">
            <h2>Product gallery</h2>

            <div className="product-gallery-preview">
              {safeList(draft.gallery).map((image, index) => (
                <div key={`${image.media_id || image.url}-${index}`}>
                  <img src={image.url} alt={image.alt || ""} />

                  <button
                    type="button"
                    aria-label="Remove gallery image"
                    onClick={() =>
                      update(
                        "gallery",
                        safeList(draft.gallery).filter(
                          (_, i) => i !== index,
                        ),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setMediaPicker("gallery")}
            >
              Add gallery images
            </button>
          </section>

          <section className="product-editor-panel">
            <h2>Categories</h2>

            <label className="product-editor-field">
              <span>Category / subcategory</span>
              <input
                list="product-category-options"
                value={draft.category}
                onChange={(event) => update("category", event.target.value)}
                placeholder="e.g. Electronics > Phones"
              />

              <datalist id="product-category-options">
                {safeList(termOptions.categories).map((term) => (
                  <option key={term} value={term} />
                ))}
              </datalist>
            </label>

            <label className="product-editor-field">
              <span>Tags (comma separated)</span>
              <input
                list="product-tag-options"
                value={safeList(draft.tags).join(", ")}
                onChange={(event) =>
                  update(
                    "tags",
                    event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="wireless, premium"
              />

              <datalist id="product-tag-options">
                {safeList(termOptions.tags).map((term) => (
                  <option key={term} value={term} />
                ))}
              </datalist>
            </label>
          </section>

          <section className="product-editor-panel">
            <h2>Brand</h2>

            <label className="product-editor-field">
              <span>Brand name</span>
              <input
                list="product-brand-options"
                value={draft.brand}
                onChange={(event) => update("brand", event.target.value)}
                placeholder="Brand"
              />

              <datalist id="product-brand-options">
                {safeList(termOptions.brands).map((term) => (
                  <option key={term} value={term} />
                ))}
              </datalist>
            </label>
          </section>
        </aside>
      </form>

      <datalist id="product-attribute-options">
        {safeList(termOptions.attributes).map((term) => (
          <option key={term} value={term} />
        ))}
      </datalist>

      <MediaPicker
        isOpen={mediaPicker !== null}
        onClose={() => setMediaPicker(null)}
        onSelect={handleMediaSelect}
        multiple={mediaPicker === "gallery"}
        fileType="image"
      />
    </div>
  );
};

export default ProductEditor;