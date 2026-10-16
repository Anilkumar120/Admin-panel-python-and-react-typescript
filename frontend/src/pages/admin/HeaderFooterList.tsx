import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  listTemplates,
  deleteTemplate,
  duplicateTemplate,
  type HeaderFooterTemplate,
  type TemplateType,
} from "../../api/templates";
import "./HeaderFooter.css";

const SITE_PARTS: {
  type: TemplateType;
  title: string;
  description: string;
  icon: string;
}[] = [
  { type: "header", title: "Header", description: "Site-wide navigation and branding", icon: "↑" },
  { type: "footer", title: "Footer", description: "Site-wide footer content", icon: "↓" },
  { type: "single_product", title: "Single Product", description: "Dynamic layout for individual products", icon: "🛍" },
  { type: "single_post", title: "Single Post", description: "Individual blog post layout", icon: "▤" },
  { type: "single_page", title: "Single Page", description: "Individual page layout", icon: "▧" },
  { type: "archive", title: "Archive", description: "Blog, category, and archive layouts", icon: "▦" },
  { type: "search_results", title: "Search Results", description: "Search results page layout", icon: "⌕" },
  { type: "loop_item", title: "Loop Item", description: "Reusable post or product item", icon: "▣" },
  { type: "error_404", title: "Error 404", description: "Not-found page layout", icon: "!" },
  { type: "shop", title: "Shop", description: "Product catalog page", icon: "🛍" },
  { type: "cart", title: "Cart", description: "Shopping cart page", icon: "🛒" },
  { type: "checkout", title: "Checkout", description: "Checkout and payment page", icon: "💳" },
  { type: "my_account", title: "My Account", description: "Customer account page", icon: "👤" },
  { type: "order_received", title: "Order Received", description: "Order confirmation page", icon: "✓" },
];

const HeaderFooterList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [templates, setTemplates] = useState<Record<string, HeaderFooterTemplate[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestedTemplate = new URLSearchParams(location.search).get("template");
  const visibleParts = requestedTemplate
    ? SITE_PARTS.filter((part) => part.type === requestedTemplate)
    : SITE_PARTS;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const entries = await Promise.all(
        SITE_PARTS.map(async ({ type }) => [type, await listTemplates(type)] as const),
      );
      setTemplates(Object.fromEntries(entries));
    } catch (err) {
      console.error("Failed to load Theme Builder templates:", err);
      setError("Unable to load site templates. Please check your connection and permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      await load();
    } catch (err) {
      console.error("Failed to delete template:", err);
      setError("Unable to delete this template.");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate(id);
      await load();
    } catch (err) {
      console.error("Failed to duplicate template:", err);
      setError("Unable to duplicate this template.");
    }
  };

  return (
    <div className="header-footer-list-page theme-builder-page">
      <div className="hf-list-header">
        <h1>Theme Builder</h1>
        <p>Create and manage the parts that make up your site.</p>
      </div>

      {error && <div className="theme-builder-error" role="alert">{error}</div>}

      {loading ? (
        <div className="hf-loading">Loading site parts...</div>
      ) : (
        <div className="theme-parts-grid">
          {visibleParts.map((part) => {
            const partTemplates = templates[part.type] || [];
            return (
              <section className="theme-part-card" key={part.type}>
                <div className="theme-part-heading">
                  <span className="theme-part-icon" aria-hidden="true">{part.icon}</span>
                  <div>
                    <h2>{part.title}</h2>
                    <p>{part.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary theme-part-create"
                  onClick={() =>
                    navigate(`/admin/appearance/header-footer/edit?type=${part.type}`)
                  }
                >
                  + Create {part.title}
                </button>
                {partTemplates.length > 0 ? (
                  <div className="theme-part-templates">
                    {partTemplates.map((template) => (
                      <div className="theme-template-row" key={template.id}>
                        <div className="theme-template-info">
                          <strong>{template.title}</strong>
                          <span className={`status-${template.status}`}>
                            {template.status}
                            {template.is_default ? " · Default" : ""}
                          </span>
                        </div>
                        <div className="theme-template-actions">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/admin/appearance/header-footer/edit?id=${template.id}&type=${part.type}`,
                              )
                            }
                          >
                            Edit
                          </button>
                          <button type="button" onClick={() => void handleDuplicate(template.id)}>
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => void handleDelete(template.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="theme-part-empty">No templates yet</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HeaderFooterList;
