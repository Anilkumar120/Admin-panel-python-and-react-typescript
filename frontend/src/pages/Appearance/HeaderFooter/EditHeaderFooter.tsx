import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import Builder from "../../../components/HeaderFooterBuilder/Builder";

import {
  getHeaderFooterMenus,
  getHeaderFooterTemplate,
  updateHeaderFooterTemplate,
  type HeaderFooterElement,
} from "../../../api/headerFooter";

const EditHeaderFooter = () => {
  const navigate = useNavigate();

  const { templateId } = useParams();

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [menus, setMenus] = useState<any[]>([]);

  const [elements, setElements] = useState<HeaderFooterElement[]>([]);

  const [name, setName] = useState("");

  const [templateType, setTemplateType] = useState<"header" | "footer">(
    "header",
  );

  const [display, setDisplay] = useState<"global" | "pages">("global");

  const [pageIds, setPageIds] = useState("");

  const [priority, setPriority] = useState(10);

  const [status, setStatus] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    if (!templateId) {
      setError("Template ID is missing.");

      setLoading(false);

      return;
    }

    try {
      setLoading(true);

      const [template, menuData] = await Promise.all([
        getHeaderFooterTemplate(templateId),

        getHeaderFooterMenus(),
      ]);

      setName(template.name || "");

      setTemplateType(
        template.template_type === "footer" ? "footer" : "header",
      );

      setDisplay(template.display === "pages" ? "pages" : "global");

      setPageIds((template.page_ids || []).join(","));

      setPriority(Number(template.priority || 10));

      setStatus(template.status !== false);

      setElements(template.elements || []);

      setMenus(menuData || []);
    } catch (error: any) {
      console.error(error);

      setError(error?.response?.data?.detail || "Unable to load template.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!templateId) {
      return;
    }

    setError("");

    if (!name.trim()) {
      setError("Please enter template name.");

      return;
    }

    const selectedPageIds = pageIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (display === "pages" && selectedPageIds.length === 0) {
      setError("Please enter at least one page ID.");

      return;
    }

    try {
      setSaving(true);

      await updateHeaderFooterTemplate(templateId, {
        name: name.trim(),

        template_type: templateType,

        display,

        page_ids: display === "pages" ? selectedPageIds : [],

        priority: Number(priority),

        status,

        elements,
      });

      navigate("/admin/appearance/header-footer");
    } catch (error: any) {
      console.error(error);

      setError(error?.response?.data?.detail || "Unable to update template.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="hf-page">
        <p>Loading template...</p>
      </div>
    );
  }

  return (
    <div className="hf-page">
      <div className="hf-page-header">
        <div>
          <h1>Edit {templateType === "header" ? "Header" : "Footer"}</h1>

          <p>Update your template and save the changes.</p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate("/admin/appearance/header-footer")}
          >
            Back
          </button>

          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Updating..." : "Update Template"}
          </button>
        </div>
      </div>

      {error && <div className="hf-error">{error}</div>}

      <div className="hf-template-settings">
        <div>
          <label>Template Name</label>

          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <label>Template Type</label>

          <select
            value={templateType}
            onChange={(event) =>
              setTemplateType(event.target.value as "header" | "footer")
            }
          >
            <option value="header">Header</option>

            <option value="footer">Footer</option>
          </select>
        </div>

        <div>
          <label>Display</label>

          <select
            value={display}
            onChange={(event) =>
              setDisplay(event.target.value as "global" | "pages")
            }
          >
            <option value="global">Entire Site</option>

            <option value="pages">Specific Pages</option>
          </select>
        </div>

        {display === "pages" && (
          <div>
            <label>Page IDs</label>

            <input
              type="text"
              value={pageIds}
              onChange={(event) => setPageIds(event.target.value)}
              placeholder="Example: 12,15,20"
            />

            <small>Enter page IDs separated by commas.</small>
          </div>
        )}

        <div>
          <label>Priority</label>

          <input
            type="number"
            value={priority}
            onChange={(event) => setPriority(Number(event.target.value))}
          />
        </div>

        <div>
          <label>Status</label>

          <label>
            <input
              type="checkbox"
              checked={status}
              onChange={(event) => setStatus(event.target.checked)}
            />
            Active
          </label>
        </div>
      </div>

      <Builder
        initialType={templateType}
        initialElements={elements}
        menus={menus}
        onChange={setElements}
      />
    </div>
  );
};

export default EditHeaderFooter;
