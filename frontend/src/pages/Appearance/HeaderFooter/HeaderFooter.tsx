import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getHeaderFooterTemplates,
  deleteHeaderFooterTemplate,
} from "../../../api/headerFooter";

interface Template {
  id: string;
  name: string;
  template_type: "header" | "footer";
  display: "global" | "pages";
  page_ids: string[];
  priority: number;
  status: boolean;
  elements: any[];
}

const normalizeTemplates = (response: unknown): Template[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === "object") {
    const data = response as Record<string, unknown>;

    for (const key of ["items", "templates", "data"]) {
      if (Array.isArray(data[key])) {
        return data[key] as Template[];
      }
    }
  }

  return [];
};

const HeaderFooter = () => {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getHeaderFooterTemplates();
      const safeTemplates = normalizeTemplates(response);

      setTemplates(safeTemplates);
    } catch (err: unknown) {
      console.error("GET HEADER FOOTER ERROR:", err);

      const message =
        (err as any)?.response?.data?.detail ||
        (err as any)?.message ||
        "Unable to load Header & Footer templates.";

      setError(String(message));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleDelete = async (template: Template) => {
    if (!template.id) {
      setError("Template ID is missing. Unable to delete this template.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${template.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(template.id);
      setError("");

      await deleteHeaderFooterTemplate(template.id);

      setTemplates((current) =>
        current.filter((item) => item.id !== template.id),
      );
    } catch (err: unknown) {
      console.error("DELETE HEADER FOOTER ERROR:", err);

      const message =
        (err as any)?.response?.data?.detail ||
        (err as any)?.message ||
        "Unable to delete template.";

      setError(String(message));
    } finally {
      setDeletingId(null);
    }
  };

  const openCreatePage = (type: "header" | "footer") => {
    navigate(`/admin/appearance/header-footer/create?type=${type}`);
  };

  const openEditPage = (id: string) => {
    navigate(`/admin/appearance/header-footer/${encodeURIComponent(id)}/edit`);
  };

  return (
    <div className="content-page">
      <div className="content-page-header">
        <div>
          <h1>Header &amp; Footer</h1>
          <p>Create and manage your website headers and footers.</p>
        </div>

        <div className="header-footer-actions">
          <button type="button" onClick={() => openCreatePage("header")}>
            Add Header
          </button>

          <button type="button" onClick={() => openCreatePage("footer")}>
            Add Footer
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
          <button
            type="button"
            onClick={() => void loadTemplates()}
            disabled={loading}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-state" role="status">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <h3>No Header or Footer found</h3>
          <p>Create your first Header or Footer template.</p>

          <button type="button" onClick={() => openCreatePage("header")}>
            Create Header
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Display</th>
                <th>Elements</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {templates.map((template, index) => {
                const templateId = String(template.id || "");

                return (
                  <tr key={templateId || `${template.name}-${index}`}>
                    <td>
                      <strong>{template.name || "Untitled template"}</strong>
                    </td>

                    <td>
                      {template.template_type === "header"
                        ? "Header"
                        : "Footer"}
                    </td>

                    <td>
                      {template.display === "global"
                        ? "Entire Site"
                        : "Specific Pages"}
                    </td>

                    <td>
                      {Array.isArray(template.elements)
                        ? template.elements.length
                        : 0}
                    </td>

                    <td>
                      <span
                        className={
                          template.status
                            ? "template-status active"
                            : "template-status inactive"
                        }
                      >
                        {template.status ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => openEditPage(templateId)}
                          disabled={!templateId || deletingId === templateId}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDelete(template)}
                          disabled={!templateId || deletingId === templateId}
                        >
                          {deletingId === templateId ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HeaderFooter;
