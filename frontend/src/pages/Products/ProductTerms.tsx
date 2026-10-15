import { useCallback, useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { API_URL } from "../../api/config";

type TermType = "categories" | "tags" | "attributes" | "brands";
interface ProductTerm {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent: string;
  options: string[];
}

const termLabels: Record<TermType, string> = {
  categories: "Categories",
  tags: "Tags",
  attributes: "Attributes",
  brands: "Brands",
};
const singularLabels: Record<TermType, string> = {
  categories: "Category",
  tags: "Tag",
  attributes: "Attribute",
  brands: "Brand",
};

const ProductTerms = ({ termType }: { termType: TermType }) => {
  const [terms, setTerms] = useState<ProductTerm[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parent, setParent] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  });

  const loadTerms = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get<{ terms: ProductTerm[] }>(
        `${API_URL}/api/product-taxonomies/${termType}`,
        { headers: headers() },
      );
      setTerms(response.data.terms);
    } catch (loadError) {
      console.error(`Unable to load product ${termType}:`, loadError);
      setError(`Unable to load product ${termLabels[termType].toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [termType]);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setParent("");
    setDescription("");
    setOptions("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      parent: parent.trim(),
      description: description.trim(),
      options: options.split(",").map((option) => option.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await axios.put(
          `${API_URL}/api/product-taxonomies/${termType}/${editing}`,
          payload,
          { headers: headers() },
        );
      } else {
        await axios.post(
          `${API_URL}/api/product-taxonomies/${termType}`,
          payload,
          { headers: headers() },
        );
      }
      resetForm();
      await loadTerms();
    } catch (saveError) {
      console.error(`Unable to save product ${termType}:`, saveError);
      setError(
        axios.isAxiosError(saveError)
          ? String(saveError.response?.data?.detail || "Unable to save this term.")
          : "Unable to save this term.",
      );
    }
  };

  const editTerm = (term: ProductTerm) => {
    setEditing(term.id);
    setName(term.name);
    setSlug(term.slug);
    setParent(term.parent || "");
    setDescription(term.description || "");
    setOptions((term.options || []).join(", "));
  };

  const deleteTerm = async (term: ProductTerm) => {
    if (!window.confirm(`Move "${term.name}" to trash?`)) return;
    setError("");
    try {
      await axios.delete(
        `${API_URL}/api/product-taxonomies/${termType}/${term.id}`,
        { headers: headers() },
      );
      await loadTerms();
    } catch (deleteError) {
      console.error(`Unable to delete product ${termType}:`, deleteError);
      setError("Unable to move this term to trash.");
    }
  };

  return (
    <div className="products-page">
      <div className="page-heading">
        <div>
          <h1>Product {termLabels[termType]}</h1>
          <p>Manage reusable product {termLabels[termType].toLowerCase()}.</p>
        </div>
      </div>
      {error && <div role="alert" className="table-error">{error}</div>}
      <div className="table-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2>{editing ? "Edit" : "Add"} {singularLabels[termType]}</h2>
        <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 700 }}>
          <label className="product-editor-field">
            <span>Name</span>
            <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="product-editor-field">
            <span>Slug</span>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="Generated from name if blank" />
          </label>
          {termType === "categories" && (
            <label className="product-editor-field">
              <span>Parent category</span>
              <select value={parent} onChange={(event) => setParent(event.target.value)}>
                <option value="">None</option>
                {terms.filter((term) => term.id !== editing).map((term) => (
                  <option key={term.id} value={term.name}>{term.name}</option>
                ))}
              </select>
            </label>
          )}
          {termType === "attributes" && (
            <label className="product-editor-field">
              <span>Attribute options (comma separated)</span>
              <input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Small, Medium, Large" />
            </label>
          )}
          <label className="product-editor-field">
            <span>Description</span>
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="primary-button">{editing ? "Update" : "Add"} {singularLabels[termType]}</button>
            {editing && <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>
      <div className="table-card">
        {loading ? <p style={{ padding: 20 }}>Loading…</p> : terms.length ? (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>Name</th><th>Slug</th><th>{termType === "attributes" ? "Options" : "Description"}</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id}>
                    <td>{term.name}{term.parent && <small style={{ display: "block" }}>Parent: {term.parent}</small>}</td>
                    <td>{term.slug}</td>
                    <td>{termType === "attributes" ? term.options?.join(", ") : term.description}</td>
                    <td>
                      <button type="button" className="secondary-button" onClick={() => editTerm(term)}>Edit</button>{" "}
                      <button type="button" className="secondary-button" onClick={() => void deleteTerm(term)}>Trash</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ padding: 20 }}>No product {termLabels[termType].toLowerCase()} found.</p>}
      </div>
    </div>
  );
};

export default ProductTerms;
