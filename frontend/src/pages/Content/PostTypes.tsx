import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getPostTypes, deletePostType, type PostType } from "../../api/content";

const PostTypes = () => {
  const [postTypes, setPostTypes] = useState<PostType[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadPostTypes = async () => {
    setLoading(true);

    setError("");

    try {
      const response = await getPostTypes();

      setPostTypes(response);
    } catch (error: any) {
      console.log("POST TYPES ERROR:", error);

      setError(error.response?.data?.detail || "Failed to load post types");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postType: PostType) => {
    if (postType.is_builtin) {
      alert("Built-in post types cannot be deleted");

      return;
    }

    const confirmDelete = window.confirm(`Delete ${postType.name}?`);

    if (!confirmDelete) {
      return;
    }

    try {
      await deletePostType(postType.id);

      await loadPostTypes();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to delete post type");
    }
  };

  useEffect(() => {
    loadPostTypes();
  }, []);

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Post Types</h1>

          <p>Manage Posts, Pages and custom content types</p>
        </div>

        <Link
          to="/admin/content/post-types/create"
          className="page-heading-button"
        >
          Add New
        </Link>
      </div>

      {error && <div className="content-message-error">{error}</div>}

      {loading ? (
        <div className="content-loading">Loading post types...</div>
      ) : (
        <div className="content-card">
          <div className="content-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Icon</th>

                  <th>Name</th>

                  <th>Slug</th>

                  <th>Type</th>

                  <th>Status</th>

                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {postTypes.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No post types found</td>
                  </tr>
                ) : (
                  postTypes.map((postType) => (
                    <tr key={postType.id}>
                      <td>
                        <span className="content-type-icon">
                          {postType.icon}
                        </span>
                      </td>

                      <td>
                        <strong>{postType.name}</strong>
                      </td>

                      <td>{postType.slug}</td>

                      <td>{postType.is_builtin ? "Built-in" : "Custom"}</td>

                      <td>{postType.is_active ? "Active" : "Inactive"}</td>

                      <td>
                        {postType.is_builtin ? (
                          <span>Default</span>
                        ) : (
                          <>
                            <Link
                              to={`/admin/content/post-types/${postType.id}/edit`}
                              className="content-action-button"
                            >
                              Edit
                            </Link>

                            <button
                              type="button"
                              className="content-delete-button"
                              onClick={() => handleDelete(postType)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostTypes;
