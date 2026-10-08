import { useEffect, useState } from "react";

import { useParams } from "react-router-dom";

import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type Category,
} from "../../api/content";

const Categories = () => {
  const { postTypeSlug } = useParams<{
    postTypeSlug: string;
  }>();

  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");

  const [slug, setSlug] = useState("");

  const [parentId, setParentId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const loadCategories = async () => {
    if (!postTypeSlug) {
      return;
    }

    try {
      const data = await getCategories(postTypeSlug);

      setCategories(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [postTypeSlug]);

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (value: string) => {
    setName(value);

    if (!editingId) {
      setSlug(generateSlug(value));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!postTypeSlug || !name.trim() || !slug.trim()) {
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        await updateCategory(editingId, name, slug, parentId);
      } else {
        await createCategory(postTypeSlug, name, slug, parentId);
      }

      setName("");

      setSlug("");

      setParentId("");

      setEditingId(null);

      await loadCategories();
    } catch (error) {
      console.error(error);

      alert("Category save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);

    setName(category.name);

    setSlug(category.slug);

    setParentId(category.parent_id || "");
  };

  const handleDelete = async (categoryId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this category?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteCategory(categoryId);

      await loadCategories();
    } catch (error) {
      console.error(error);

      alert("Category delete failed");
    }
  };

  const handleCancel = () => {
    setEditingId(null);

    setName("");

    setSlug("");

    setParentId("");
  };

  return (
    <div className="content-page">
      <div className="page-header">
        <div>
          <h1>Categories</h1>

          <p>Manage categories for this content type.</p>
        </div>
      </div>

      <div className="content-grid">
        <div className="content-card">
          <h2>{editingId ? "Edit Category" : "Add New Category"}</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>

              <input
                type="text"
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Category name"
                required
              />
            </div>

            <div className="form-group">
              <label>Slug</label>

              <input
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="category-slug"
                required
              />
            </div>

            <div className="form-group">
              <label>Parent Category</label>

              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">None</option>

                {categories
                  .filter((category) => category.id !== editingId)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading
                  ? "Saving..."
                  : editingId
                    ? "Update Category"
                    : "Add Category"}
              </button>

              {editingId && (
                <button type="button" onClick={handleCancel}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="content-card">
          <h2>Categories</h2>

          {categories.length === 0 ? (
            <p>No categories found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>

                  <th>Slug</th>

                  <th>Parent</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {categories.map((category) => {
                  const parent = categories.find(
                    (item) => item.id === category.parent_id,
                  );

                  return (
                    <tr key={category.id}>
                      <td>{category.name}</td>

                      <td>{category.slug}</td>

                      <td>{parent ? parent.name : "—"}</td>

                      <td>
                        <button
                          type="button"
                          onClick={() => handleEdit(category)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(category.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Categories;
