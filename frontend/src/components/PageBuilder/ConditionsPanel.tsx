import { useEffect, useState } from "react";
import {
  getAllSources,
  type TemplateConditions,
  type TemplateSources,
} from "../../api/templates";
import "./ConditionsPanel.css";

interface ConditionsPanelProps {
  conditions: TemplateConditions;
  onChange: (c: TemplateConditions) => void;
  isDefault: boolean;
  onDefaultChange: (v: boolean) => void;
}

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

  if (loading) return <div className="conditions-panel-loading">Loading...</div>;

  return (
    <div className="conditions-panel">
      <div className="conditions-header">
        <h3>📍 Where to Display</h3>
        <p className="conditions-hint">Choose where this template appears</p>
      </div>

      <div className="conditions-tabs">
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
            className={activeTab === t.key ? "active" : ""}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="conditions-body">
        {activeTab === "general" && (
          <div className="conditions-list">
            {[
              { v: "entire_site", l: "🌐 Entire Site" },
              { v: "home", l: "🏠 Home Page" },
              { v: "front_page", l: "⭐ Front Page" },
              { v: "blog", l: "📝 Blog Page" },
              { v: "search", l: "🔍 Search Results" },
              { v: "404", l: "❌ 404 Page" },
            ].map((opt) => (
              <label key={opt.v} className="condition-checkbox">
                <input
                  type="checkbox"
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
            <div className="conditions-group">
              <h4>📃 Pages</h4>
              <label className="condition-checkbox">
                <input
                  type="checkbox"
                  checked={isChecked("include", "pages")}
                  onChange={() => toggle("include", "pages")}
                />
                <span>All Pages</span>
              </label>
              <label className="condition-checkbox">
                <input
                  type="checkbox"
                  checked={isChecked("singles", "pages")}
                  onChange={() => toggle("singles", "pages")}
                />
                <span>Single Page</span>
              </label>
            </div>

            <div className="conditions-group">
              <h4>📰 Posts</h4>
              <label className="condition-checkbox">
                <input
                  type="checkbox"
                  checked={isChecked("include", "posts")}
                  onChange={() => toggle("include", "posts")}
                />
                <span>All Posts</span>
              </label>
              <label className="condition-checkbox">
                <input
                  type="checkbox"
                  checked={isChecked("singles", "posts")}
                  onChange={() => toggle("singles", "posts")}
                />
                <span>Single Post</span>
              </label>
              <label className="condition-checkbox">
                <input
                  type="checkbox"
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
            <label className="condition-checkbox">
              <input
                type="checkbox"
                checked={isChecked("include", "products")}
                onChange={() => toggle("include", "products")}
              />
              <span>🛍️ All Products</span>
            </label>
            <label className="condition-checkbox">
              <input
                type="checkbox"
                checked={isChecked("singles", "products")}
                onChange={() => toggle("singles", "products")}
              />
              <span>📦 Single Product</span>
            </label>
            <label className="condition-checkbox">
              <input
                type="checkbox"
                checked={isChecked("archives", "products")}
                onChange={() => toggle("archives", "products")}
              />
              <span>🏪 Products Archive</span>
            </label>
            <label className="condition-checkbox">
              <input
                type="checkbox"
                checked={isChecked("taxonomies", "product_cat")}
                onChange={() => toggle("taxonomies", "product_cat")}
              />
              <span>📂 Product Category</span>
            </label>
          </div>
        )}

        {activeTab === "custom" && (
          <>
            <h4>Custom Post Types</h4>
            {!sources?.custom_post_types?.length ? (
              <p className="no-items">No custom post types</p>
            ) : (
              sources.custom_post_types.map((pt) => (
                <div key={pt.id} className="custom-pt-block">
                  <div className="custom-pt-title">{pt.label}</div>
                  <label className="condition-checkbox">
                    <input
                      type="checkbox"
                      checked={isChecked("post_types", pt.slug)}
                      onChange={() => toggle("post_types", pt.slug)}
                    />
                    <span>All {pt.label}</span>
                  </label>
                  <label className="condition-checkbox">
                    <input
                      type="checkbox"
                      checked={isChecked("singles", pt.slug)}
                      onChange={() => toggle("singles", pt.slug)}
                    />
                    <span>Single {pt.label}</span>
                  </label>
                  <label className="condition-checkbox">
                    <input
                      type="checkbox"
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
            <div className="specific-group">
              <h4>Specific Pages</h4>
              <div className="specific-list">
                {sources?.pages?.map((p) => (
                  <label key={p.id} className="condition-checkbox">
                    <input
                      type="checkbox"
                      checked={(conditions.specific_pages || []).includes(p.id)}
                      onChange={() => toggle("specific_pages", p.id)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="specific-group">
              <h4>Specific Posts</h4>
              <div className="specific-list">
                {sources?.posts?.map((p) => (
                  <label key={p.id} className="condition-checkbox">
                    <input
                      type="checkbox"
                      checked={(conditions.specific_posts || []).includes(p.id)}
                      onChange={() => toggle("specific_posts", p.id)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="specific-group">
              <h4>Specific Products</h4>
              <div className="specific-list">
                {sources?.products?.map((p) => (
                  <label key={p.id} className="condition-checkbox">
                    <input
                      type="checkbox"
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
                  <div key={ptSlug} className="specific-group">
                    <h4>{pt?.label || ptSlug} Items</h4>
                    <div className="specific-list">
                      {items.map((item) => (
                        <label key={item.id} className="condition-checkbox">
                          <input
                            type="checkbox"
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

      <div className="conditions-footer">
        <div className="priority-section">
          <h4>🎯 Priority</h4>
          <input
            type="number"
            value={conditions.priority || 0}
            onChange={(e) =>
              onChange({ ...conditions, priority: Number(e.target.value) })
            }
          />
          <small>Higher priority wins</small>
        </div>

        <label className="condition-checkbox default-check">
          <input
            type="checkbox"
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