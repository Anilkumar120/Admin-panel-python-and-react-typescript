import { useEffect, useState } from "react";

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

const HeaderFooter = () => {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<Template[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadTemplates = async () => {
    try {
      setLoading(true);

      setError("");

      const response = await getHeaderFooterTemplates();

      setTemplates(response || []);
    } catch (error: any) {
      console.log("GET HEADER FOOTER ERROR:", error);

      setError(error?.response?.data?.detail || "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDelete = async (template: Template) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${template.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteHeaderFooterTemplate(template.id);

      setTemplates((current) =>
        current.filter((item) => item.id !== template.id),
      );
    } catch (error: any) {
      console.log("DELETE HEADER FOOTER ERROR:", error);

      alert(error?.response?.data?.detail || "Unable to delete template.");
    }
  };

  return (
    <div className="content-page">
      <div className="content-page-header">
        <div>
          <h1>Header & Footer</h1>

          <p>Create and manage your website headers and footers.</p>
        </div>

        <div>
          <button
            type="button"
            onClick={() =>
              navigate("/admin/appearance/header-footer/create?type=header")
            }
          >
            Add Header
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/appearance/header-footer/create?type=footer")
            }
          >
            Add Footer
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <h3>No Header or Footer found</h3>

          <p>Create your first Header or Footer template.</p>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/appearance/header-footer/create?type=header")
            }
          >
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
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>
                    <strong>{template.name}</strong>
                  </td>

                  <td>
                    {template.template_type === "header" ? "Header" : "Footer"}
                  </td>

                  <td>
                    {template.display === "global"
                      ? "Entire Site"
                      : "Specific Pages"}
                  </td>

                  <td>{template.elements?.length || 0}</td>

                  <td>{template.status ? "Active" : "Inactive"}</td>

                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/admin/appearance/header-footer/${template.id}/edit`,
                        )
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HeaderFooter;
