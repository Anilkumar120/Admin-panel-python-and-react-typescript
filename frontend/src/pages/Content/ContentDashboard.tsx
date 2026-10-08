import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getContentStats, type ContentStats } from "../../api/content";

const ContentDashboard = () => {
  const [stats, setStats] = useState<ContentStats>({
    posts: 0,
    pages: 0,
    custom_post_types: 0,
    taxonomies: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await getContentStats();

        setStats(response);
      } catch (error) {
        console.log("CONTENT STATS ERROR:", error);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Content</h1>

          <p>Manage your website content</p>
        </div>
      </div>

      <div className="content-dashboard-grid">
        <div className="content-stat-card">
          <div className="content-stat-icon">📝</div>

          <div>
            <div className="content-stat-title">Posts</div>

            <div className="content-stat-value">{stats.posts}</div>
          </div>

          <Link to="/admin/content/posts" className="content-primary-button">
            Manage Posts
          </Link>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">📄</div>

          <div>
            <div className="content-stat-title">Pages</div>

            <div className="content-stat-value">{stats.pages}</div>
          </div>

          <Link to="/admin/content/pages" className="content-primary-button">
            Manage Pages
          </Link>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">🧩</div>

          <div>
            <div className="content-stat-title">Custom Post Types</div>

            <div className="content-stat-value">{stats.custom_post_types}</div>
          </div>

          <Link
            to="/admin/content/post-types"
            className="content-primary-button"
          >
            Manage Types
          </Link>
        </div>

        <div className="content-stat-card">
          <div className="content-stat-icon">🗂️</div>

          <div>
            <div className="content-stat-title">Taxonomies</div>

            <div className="content-stat-value">{stats.taxonomies}</div>
          </div>

          <button type="button" className="content-primary-button">
            Manage Taxonomies
          </button>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h2>Quick Actions</h2>

            <p>Create and manage your website content</p>
          </div>
        </div>

        <div className="content-actions">
          <Link
            to="/admin/content/posts/create"
            className="content-primary-button"
          >
            + Add Post
          </Link>

          <Link
            to="/admin/content/pages/create"
            className="content-primary-button"
          >
            + Add Page
          </Link>

          <Link
            to="/admin/content/post-types/create"
            className="content-primary-button"
          >
            + Add Content Type
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ContentDashboard;
