
import axios from "axios";
import { useRef, useState } from "react";
import { createProduct, type Product } from "../../api/products";
import { importMediaFromUrl } from "../../api/media";

interface ProductImportExportProps {
  products: Product[];
  onImported: () => void | Promise<void>;
}

interface ImportProduct {
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
  brand: string;
  mediaId: string;
  productData: Record<string, unknown>;
}

type CsvRow = Record<string, string>;

const IMAGE_KEYS = [
  "image",
  "images",
  "image_url",
  "imageurl",
  "image_urls",
  "imageurls",
  "thumbnail",
  "thumbnail_url",
  "featured_image",
  "featuredimage",
  "image src",
  "variant image",
  "src",
  "gallery",
];

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)(\?.*)?(#.*)?$/i;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function getValue(
  obj: Record<string, unknown>,
  names: string[],
): unknown {
  const wanted = names.map(normalizeKey);

  for (const [key, value] of Object.entries(obj)) {
    if (
      wanted.includes(normalizeKey(key)) &&
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return undefined;
}

function toText(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;

      row.push(cell.trim());

      if (row.some((item) => item !== "")) {
        rows.push(row);
      }

      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());

  if (row.some((item) => item !== "")) {
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((values) => {
    const result: CsvRow = {};

    headers.forEach((header, index) => {
      result[header] = values[index] ?? "";
    });

    return result;
  });
}

function parseJsonProducts(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item),
    );
  }

  if (!value || typeof value !== "object") return [];

  const object = value as Record<string, unknown>;

  for (const key of ["products", "items", "data", "results"]) {
    const nested = object[key];

    if (Array.isArray(nested)) {
      return parseJsonProducts(nested);
    }

    if (nested && typeof nested === "object") {
      const result = parseJsonProducts(nested);
      if (result.length) return result;
    }
  }

  return [object];
}

function collectImageValues(value: unknown): string[] {
  const result: string[] = [];

  function visit(item: unknown, key = ""): void {
    if (typeof item === "string") {
      const normalizedKey = normalizeKey(key);
      const isImageField = IMAGE_KEYS.some(
        (imageKey) => normalizeKey(imageKey) === normalizedKey,
      );
      const trimmed = item.trim();

      if (
        trimmed &&
        (isImageField || IMAGE_EXTENSIONS.test(trimmed)) &&
        !trimmed.startsWith("data:")
      ) {
        result.push(trimmed);
      }

      return;
    }

    if (Array.isArray(item)) {
      item.forEach((child) => visit(child, key));
      return;
    }

    if (item && typeof item === "object") {
      Object.entries(item as Record<string, unknown>).forEach(
        ([childKey, childValue]) => visit(childValue, childKey),
      );
    }
  }

  visit(value);
  return [...new Set(result)];
}

function getImageUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function normalizeProduct(
  source: Record<string, unknown>,
): ImportProduct {
  const name = toText(
    getValue(source, [
      "name",
      "title",
      "product_name",
      "product title",
    ]),
  );

  const description = toText(
    getValue(source, ["description", "body_html", "body", "details"]),
  );

  const price = toNumber(
    getValue(source, [
      "price",
      "sale_price",
      "regular_price",
      "variant price",
    ]),
    0,
  );

  const quantity = toNumber(
    getValue(source, [
      "quantity",
      "stock",
      "stock_quantity",
      "inventory_quantity",
      "variant inventory qty",
    ]),
    0,
  );

  const category = toText(
    getValue(source, ["category", "product_type", "type", "categories"]),
    "Uncategorized",
  );

  const brand = toText(
    getValue(source, ["brand", "vendor", "manufacturer"]),
  );

  return {
    name,
    description,
    price,
    quantity,
    category,
    brand,
    mediaId: "",
    productData: { ...source },
  };
}

export default function ProductImportExport({
  products,
  onImported,
}: ProductImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function importImage(url: string): Promise<string> {
    const normalizedUrl = getImageUrl(url);

    if (!normalizedUrl) {
      console.warn("Invalid image URL:", url);
      return "";
    }

    try {
      const result = await importMediaFromUrl(normalizedUrl);
      const media = result?.item ?? result?.media ?? result;

      const mediaId =
        media?.media_id ??
        media?._id ??
        media?.id;

      if (!mediaId) {
        console.error("Image import returned no media ID:", result);
        return "";
      }

      return String(mediaId);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error("Image URL:", normalizedUrl);
        console.error("HTTP status:", err.response?.status);
        console.error("Backend error:", err.response?.data);
      } else {
        console.error("Image import error:", err);
      }

      return "";
    }
  }

  async function handleImport(file?: File) {
    if (!file) return;

    setLoading(true);
    setError("");
    setMessage("");
    setProgress("Reading import file...");

    const imageCache = new Map<string, string>();
    let created = 0;
    let failed = 0;
    let imageFailures = 0;

    try {
      const text = await file.text();
      const extension = file.name.split(".").pop()?.toLowerCase();

      let sourceProducts: Record<string, unknown>[];

      if (extension === "json") {
        sourceProducts = parseJsonProducts(JSON.parse(text));
      } else if (extension === "csv") {
        sourceProducts = parseCsv(text);
      } else {
        throw new Error("Please select a CSV or JSON file.");
      }

      if (!sourceProducts.length) {
        throw new Error("No products found in the selected file.");
      }

      // Group Shopify rows by Handle; keep rows without Handle separate.
      const grouped = new Map<string, Record<string, unknown>>();

      sourceProducts.forEach((row, index) => {
        const handle = toText(
          getValue(row, ["handle", "slug", "product_handle"]),
        );
        const title = toText(
          getValue(row, ["title", "name", "product_name"]),
        );

        const groupKey = handle
          ? `handle:${handle}`
          : `row:${index}:${title}`;

        const existing = grouped.get(groupKey);

        if (!existing) {
          grouped.set(groupKey, {
            ...row,
            __importRows: [row],
          });
        } else {
          const rows = existing.__importRows as Record<string, unknown>[];
          rows.push(row);
        }
      });

      const records = [...grouped.values()];

      for (let index = 0; index < records.length; index++) {
        const source = records[index];

        setProgress(
          `Importing product ${index + 1} of ${records.length}...`,
        );

        try {
          const rows =
            (source.__importRows as Record<string, unknown>[]) ?? [source];

          const primaryRow =
            rows.find((row) =>
              Boolean(getValue(row, ["title", "name", "product_name"])),
            ) ?? rows[0];

          const normalized = normalizeProduct(primaryRow);

          if (!normalized.name) {
            throw new Error("Product name is missing.");
          }

          const variantRows = rows.filter(
            (row) =>
              getValue(row, [
                "variant price",
                "variant sku",
                "variant inventory qty",
              ]) !== undefined,
          );

          const variantData = variantRows.map((row) => ({
            title: toText(
              getValue(row, ["option1 value", "variant title", "title"]),
            ),
            sku: toText(getValue(row, ["variant sku", "sku"])),
            price: toNumber(
              getValue(row, ["variant price", "price"]),
              normalized.price,
            ),
            quantity: toNumber(
              getValue(row, [
                "variant inventory qty",
                "inventory_quantity",
                "quantity",
              ]),
              0,
            ),
            option1: toText(getValue(row, ["option1 value"])),
            option2: toText(getValue(row, ["option2 value"])),
            option3: toText(getValue(row, ["option3 value"])),
          }));

          if (variantData.length) {
            normalized.productData.variants = variantData;

            if (!normalized.price) {
              normalized.price = variantData[0].price;
            }

            normalized.quantity = variantData.reduce(
              (total, variant) => total + variant.quantity,
              0,
            );
          }

          const imageValues = [
            ...collectImageValues(source),
            ...rows.flatMap((row) => collectImageValues(row)),
          ];

          const imageUrls = [
            ...new Set(imageValues.map(getImageUrl).filter(
              (url): url is string => Boolean(url),
            )),
          ];

          const mediaIds: string[] = [];

          for (const imageUrl of imageUrls) {
            if (imageCache.has(imageUrl)) {
              const cachedId = imageCache.get(imageUrl);
              if (cachedId) mediaIds.push(cachedId);
              continue;
            }

            const mediaId = await importImage(imageUrl);
            imageCache.set(imageUrl, mediaId);

            if (mediaId) {
              mediaIds.push(mediaId);
            } else {
              imageFailures++;
            }
          }

          const uniqueMediaIds = [...new Set(mediaIds)];

          normalized.mediaId = uniqueMediaIds[0] ?? "";
          normalized.productData.mediaId = normalized.mediaId;
          normalized.productData.image_media_ids = uniqueMediaIds;
          normalized.productData.gallery_media_ids = uniqueMediaIds;
          normalized.productData.imported_image_urls = imageUrls;

          if (normalized.price < 0 || normalized.quantity < 0) {
            throw new Error("Price and quantity cannot be negative.");
          }

          await createProduct(
            normalized.name,
            normalized.description,
            normalized.price,
            normalized.quantity,
            normalized.category,
            normalized.brand || "",
            normalized.mediaId || "",
            normalized.productData as Partial<Product>,
          );

          created++;
        } catch (productError) {
          failed++;
          console.error("Product import failed:", source, productError);
        }
      }

      await onImported();

      setMessage(
        `Import finished. Created: ${created}, failed: ${failed}, image failures: ${imageFailures}.`,
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import the selected file.",
      );
    } finally {
      setLoading(false);
      setProgress("");

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(products, null, 2)], {
      type: "application/json",
    });

    downloadBlob(blob, "products-export.json");
  }

  function exportCsv() {
    const columns = [
      "name",
      "description",
      "price",
      "quantity",
      "category",
      "brand",
      "image",
    ];

    const escapeCsv = (value: unknown) => {
      const text = value == null ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = products.map((product) => {
      const item = product as unknown as Record<string, unknown>;

      return columns.map((column) => {
        if (column === "image") {
          return escapeCsv(
            item.mediaId ?? item.media_id ?? item.image ?? "",
          );
        }

        return escapeCsv(item[column]);
      });
    });

    const csv = [
      columns.map(escapeCsv).join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\r\n");

    downloadBlob(
      new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
      }),
      "products-export.csv",
    );
  }

  return (
    <section className="product-import-export">
      <h3>Product Import / Export</h3>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        disabled={loading}
        onChange={(event) => handleImport(event.target.files?.[0])}
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 12,
        }}
      >
        <button
          type="button"
          disabled={loading}
          onClick={() => fileRef.current?.click()}
        >
          {loading ? "Importing..." : "Import CSV / JSON"}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={exportCsv}
        >
          Export CSV
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={exportJson}
        >
          Export JSON
        </button>
      </div>

      {progress && <p role="status">{progress}</p>}
      {message && <p role="status">{message}</p>}

      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}

      
    </section>
  );
}
