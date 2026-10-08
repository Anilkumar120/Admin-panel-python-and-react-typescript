import { useEffect, useState } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import Builder from "../../../components/HeaderFooterBuilder/Builder";

import {
  createHeaderFooterTemplate,
  getHeaderFooterMenus,
  type HeaderFooterElement,
} from "../../../api/headerFooter";

const CreateHeaderFooter = () => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const type = searchParams.get("type") === "footer" ? "footer" : "header";

  const [menus, setMenus] = useState<any[]>([]);

  const [elements, setElements] = useState<HeaderFooterElement[]>([]);

  const [name, setName] = useState(
    type === "header" ? "Global Header" : "Global Footer",
  );

  const [display, setDisplay] = useState<"global" | "pages">("global");

  const [pageIds, setPageIds] = useState("");

  const [priority, setPriority] = useState(10);

  const [status, setStatus] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    try {
      const data = await getHeaderFooterMenus();

      setMenus(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = async () => {
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

      await createHeaderFooterTemplate({
        name: name.trim(),

        template_type: type,

        display,

        page_ids: display === "pages" ? selectedPageIds : [],

        priority: Number(priority),

        status,

        elements,
      });

      navigate("/admin/appearance/header-footer");
    } catch (error: any) {
      console.error(error);

      setError(error?.response?.data?.detail || "Unable to create template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hf-page">
      <div className="hf-page-header">
        <div>
          <h1>Create {type === "header" ? "Header" : "Footer"}</h1>

          <p>Build your {type} using drag and drop elements.</p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate("/admin/appearance/header-footer")}
          >
            Back
          </button>

          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Template"}
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
        initialType={type}
        initialElements={elements}
        menus={menus}
        onChange={setElements}
      />
    </div>
  );
};

export default CreateHeaderFooter;
