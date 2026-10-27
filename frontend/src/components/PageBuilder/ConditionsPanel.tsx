import { useEffect, useState } from "react";
import {
  getAllSources,
  type TemplateConditions,
  type TemplateSources,
} from "../../api/templates";

interface ConditionsPanelProps {
  conditions: TemplateConditions;
  onChange: (c: TemplateConditions) => void;
  isDefault: boolean;
  onDefaultChange: (v: boolean) => void;
}

const checkboxClass =
  "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-xs text-[#333] transition-colors hover:bg-[#f0f4f9]";
const checkboxInputClass =
  "m-0 h-[15px] w-[15px] shrink-0 cursor-pointer accent-[#0c2f55]";
const sectionHeadingClass =
  "mt-0 mb-2 text-[13px] font-bold text-[#0c2f55]";

const ConditionsPanel = ({
  conditions,
  onChange,
  isDefault,
  onDefaultChange,
}: ConditionsPanelProps) => {
  const [sources, setSources] = useState<TemplateSources | null>(null);
  const [activeTab, setActiveTab] = useState<string>("general");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const s = await getAllSources();
        setSources(s);
      } catch (err) {
        console.error("Sources load error:", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const toggle = (key: keyof TemplateConditions, value: string) => {
    const current = (conditions[key] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...conditions, [key]: updated });
  };

  const isChecked = (key: keyof TemplateConditions, value: string) => {
    return ((conditions[key] as string[]) || []).includes(value);
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-[13px] text-[#888]">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white p-4">
      <div>
        <h3 className="mt-0 mb-1 text-[15px] font-bold text-[#0c2f55]">
          📍 Where to Display
        </h3>
        <p className="mt-0 mb-4 text-xs text-[#888]">
          Choose where this template appears
        </p>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[#e0e6ed] pb-2">
        {[
          { key: "general", label: "🌐 General" },
          { key: "content", label: "📄 Content" },
          { key: "products", label: "🛍️ Products" },
          { key: "custom", label: "🧩 Custom" },
          { key: "specific", label: "🎯 Specific" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`whitespace-nowrap rounded-[5px] border px-[10px] py-1.5 text-[11px] font-semibold text-[#555] transition-colors hover:bg-[#e3ecf5] ${
              activeTab === t.key
                ? "border-[#0c2f55] bg-[#0c2f55] text-white"
                : "border-[#d9e2ec] bg-[#f0f4f9]"
            }`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        {activeTab === "general" && (
          <div className="flex flex-col gap-1">
            {[
              { v: "entire_site", l: "🌐 Entire Site" },
              { v: "home", l: "🏠 Home Page" },
              { v: "front_page", l: "⭐ Front Page" },
              { v: "blog", l: "📝 Blog Page" },
              { v: "search", l: "🔍 Search Results" },
              { v: "404", l: "❌ 404 Page" },
            ].map((opt) => (
              <label key={opt.v} className={checkboxClass}>
                <input
                  type="checkbox"
                  className={checkboxInputClass}
                  checked={isChecked("include", opt.v)}
                  onChange={() => toggle("include", opt.v)}
                />
                <span>{opt.l}</span>
              </label>
            ))}
          </div>
        )}

        {activeTab === "content" && (
          <>
            <div className="mb-4 flex flex-col gap-1 border-b border-[#e0e6ed] pb-3">
              <h4 className={sectionHeadingClass}>📃 Pages</h4>
              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  className={checkboxInputClass}
                  checked={isChecked("include", "pages")}
                  onChange={() => toggle("include", "pages")}
                />
                <span>All Pages</span>
              </label>
              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  className={checkboxInputClass}
                  checked={isChecked("singles", "pages")}
                  onChange={() => toggle("singles", "pages")}
                />
                <span>Single Page</span>
              </label>
            </div>

            <div className="mb-4 flex flex-col gap-1 border-b border-[#e0e6ed] pb-3">
              <h4 className={sectionHeadingClass}>📰 Posts</h4>
              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  className={checkboxInputClass}
                  checked={isChecked("include", "posts")}
                  onChange={() => toggle("include", "posts")}
                />
                <span>All Posts</span>
              </label>
              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  className={checkboxInputClass}
                  checked={isChecked("singles", "posts")}
                  onChange={() => toggle("singles", "posts")}
                />
                <span>Single Post</span>
              </label>
              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  className={checkboxInputClass}
                  checked={isChecked("archives", "posts")}
                  onChange={() => toggle("archives", "posts")}
                />
                <span>Blog Archive</span>
              </label>
            </div>
          </>
        )}

        {activeTab === "products" && (
          <div className="conditions-list">
            <label className={checkboxClass}>
              <input
                type="checkbox"
                className={checkboxInputClass}
                checked={isChecked("include", "products")}
                onChange={() => toggle("include", "products")}
              />
              <span>🛍️ All Products</span>
            </label>
            <label className={checkboxClass}>
              <input
                type="checkbox"
                className={checkboxInputClass}
                checked={isChecked("singles", "products")}
                onChange={() => toggle("singles", "products")}
              />
              <span>📦 Single Product</span>
            </label>
            <label className={checkboxClass}>
              <input
                type="checkbox"
                className={checkboxInputClass}
                checked={isChecked("archives", "products")}
                onChange={() => toggle("archives", "products")}
              />
              <span>🏪 Products Archive</span>
            </label>
            <label className={checkboxClass}>
              <input
                type="checkbox"
                className={checkboxInputClass}
                checked={isChecked("taxonomies", "product_cat")}
                onChange={() => toggle("taxonomies", "product_cat")}
              />
              <span>📂 Product Category</span>
            </label>
          </div>
        )}

        {activeTab === "custom" && (
          <>
            <h4 className={sectionHeadingClass}>Custom Post Types</h4>
            {!sources?.custom_post_types?.length ? (
              <p className="m-0 p-2 text-xs italic text-[#999]">
                No custom post types
              </p>
            ) : (
              sources.custom_post_types.map((pt) => (
                <div
                  key={pt.id}
                  className="mb-[10px] rounded-md bg-[#f7f9fc] p-[10px]"
                >
                  <div className="mb-1.5 text-[13px] font-bold text-[#0c2f55]">
                    {pt.label}
                  </div>
                  <label className={checkboxClass}>
                    <input
                      type="checkbox"
                      className={checkboxInputClass}
                      checked={isChecked("post_types", pt.slug)}
                      onChange={() => toggle("post_types", pt.slug)}
                    />
                    <span>All {pt.label}</span>
                  </label>
                  <label className={checkboxClass}>
                    <input
                      type="checkbox"
                      className={checkboxInputClass}
                      checked={isChecked("singles", pt.slug)}
                      onChange={() => toggle("singles", pt.slug)}
                    />
                    <span>Single {pt.label}</span>
                  </label>
                  <label className={checkboxClass}>
                    <input
                      type="checkbox"
                      className={checkboxInputClass}
                      checked={isChecked("archives", pt.slug)}
                      onChange={() => toggle("archives", pt.slug)}
                    />
                    <span>{pt.label} Archive</span>
                  </label>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "specific" && (
          <>
            <div className="mb-4">
              <h4 className={sectionHeadingClass}>Specific Pages</h4>
              <div className="max-h-[200px] overflow-y-auto rounded-md border border-[#e0e6ed] bg-white p-1.5">
                {sources?.pages?.map((p) => (
                  <label key={p.id} className={checkboxClass}>
                    <input
                      type="checkbox"
                      className={checkboxInputClass}
                      checked={(conditions.specific_pages || []).includes(p.id)}
                      onChange={() => toggle("specific_pages", p.id)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h4 className={sectionHeadingClass}>Specific Posts</h4>
              <div className="max-h-[200px] overflow-y-auto rounded-md border border-[#e0e6ed] bg-white p-1.5">
                {sources?.posts?.map((p) => (
                  <label key={p.id} className={checkboxClass}>
                    <input
                      type="checkbox"
                      className={checkboxInputClass}
                      checked={(conditions.specific_posts || []).includes(p.id)}
                      onChange={() => toggle("specific_posts", p.id)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h4 className={sectionHeadingClass}>Specific Products</h4>
              <div className="max-h-[200px] overflow-y-auto rounded-md border border-[#e0e6ed] bg-white p-1.5">
                {sources?.products?.map((p) => (
                  <label key={p.id} className={checkboxClass}>
                    <input
                      type="checkbox"
                      className={checkboxInputClass}
                      checked={(conditions.specific_products || []).includes(p.id)}
                      onChange={() => toggle("specific_products", p.id)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {sources?.custom_items &&
              Object.entries(sources.custom_items).map(([ptSlug, items]) => {
                if (!items.length) return null;
                const pt = sources.custom_post_types.find((c) => c.slug === ptSlug);
                return (
                  <div key={ptSlug} className="mb-4">
                    <h4 className={sectionHeadingClass}>
                      {pt?.label || ptSlug} Items
                    </h4>
                    <div className="max-h-[200px] overflow-y-auto rounded-md border border-[#e0e6ed] bg-white p-1.5">
                      {items.map((item) => (
                        <label key={item.id} className={checkboxClass}>
                          <input
                            type="checkbox"
                            className={checkboxInputClass}
                            checked={(conditions.specific_items || []).includes(item.id)}
                            onChange={() => toggle("specific_items", item.id)}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </div>

      <div className="mt-2 border-t border-[#e0e6ed] pt-4">
        <div className="mb-4">
          <h4 className="mt-0 mb-1.5 text-[13px] text-[#0c2f55]">
            🎯 Priority
          </h4>
          <input
            type="number"
            className="mb-1 box-border w-full rounded-[5px] border border-[#d9e2ec] px-[10px] py-2 text-[13px] focus:border-[#0c2f55] focus:outline-none"
            value={conditions.priority || 0}
            onChange={(e) =>
              onChange({ ...conditions, priority: Number(e.target.value) })
            }
          />
          <small className="block text-[11px] text-[#888]">
            Higher priority wins
          </small>
        </div>

        <label className={`${checkboxClass} border border-[#ffe082] bg-[#fff8e1] p-[10px]`}>
          <input
            type="checkbox"
            className={checkboxInputClass}
            checked={isDefault}
            onChange={(e) => onDefaultChange(e.target.checked)}
          />
          <span>⭐ Set as Default (fallback)</span>
        </label>
      </div>
    </div>
  );
};

export default ConditionsPanel;