import { useEffect, useState } from "react";

import { useParams } from "react-router-dom";

import {
  createTag,
  deleteTag,
  getTags,
  updateTag,
  type Tag,
} from "../../api/content";

const Tags = () => {
  const { postTypeSlug } = useParams<{
    postTypeSlug: string;
  }>();

  const [tags, setTags] = useState<Tag[]>([]);

  const [name, setName] = useState("");

  const [slug, setSlug] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const loadTags = async () => {
    if (!postTypeSlug) {
      return;
    }

    try {
      const data = await getTags(postTypeSlug);

      setTags(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadTags();
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
        await updateTag(editingId, name, slug);
      } else {
        await createTag(postTypeSlug, name, slug);
      }

      setName("");

      setSlug("");

      setEditingId(null);

      await loadTags();
    } catch (error) {
      console.error(error);

      alert("Tag save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingId(tag.id);

    setName(tag.name);

    setSlug(tag.slug);
  };

  const handleDelete = async (tagId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this tag?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteTag(tagId);

      await loadTags();
    } catch (error) {
      console.error(error);

      alert("Tag delete failed");
    }
  };

  const handleCancel = () => {
    setEditingId(null);

    setName("");

    setSlug("");
  };

  return (
    <div className="content-page">
      <div className="page-header">
        <div>
          <h1>Tags</h1>

          <p>Manage tags for this content type.</p>
        </div>
      </div>

      <div className="content-grid">
        <div className="content-card">
          <h2>{editingId ? "Edit Tag" : "Add New Tag"}</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>

              <input
                type="text"
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Tag name"
                required
              />
            </div>

            <div className="form-group">
              <label>Slug</label>

              <input
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="tag-slug"
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : editingId ? "Update Tag" : "Add Tag"}
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
          <h2>Tags</h2>

          {tags.length === 0 ? (
            <p>No tags found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>

                  <th>Slug</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td>{tag.name}</td>

                    <td>{tag.slug}</td>

                    <td>
                      <button type="button" onClick={() => handleEdit(tag)}>
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(tag.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Tags;
