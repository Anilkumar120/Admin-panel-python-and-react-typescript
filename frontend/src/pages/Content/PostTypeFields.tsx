import { useEffect, useState } from "react";

import { useParams } from "react-router-dom";

import { getPostType, type PostType } from "../../api/content";

const PostTypeFields = () => {
  const { postTypeId } = useParams();

  const [postType, setPostType] = useState<PostType | null>(null);

  const [loading, setLoading] = useState(true);

  const loadPostType = async () => {
    if (!postTypeId) {
      return;
    }

    try {
      const response = await getPostType(postTypeId);

      setPostType(response);
    } catch (error) {
      console.log("POST TYPE FIELDS ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPostType();
  }, [postTypeId]);

  if (loading) {
    return (
      <div className="content-page">
        <div className="content-loading">Loading fields...</div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Custom Fields</h1>

          <p>{postType?.name} field configuration</p>
        </div>
      </div>

      <div className="content-card">
        <h2>Fields</h2>

        <p>No custom fields created yet.</p>

        <button type="button">Add Field</button>
      </div>
    </div>
  );
};

export default PostTypeFields;
