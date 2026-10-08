import { useEffect, useState } from "react";

import { NavLink } from "react-router-dom";

import { getPostTypes, type PostType } from "../../api/content";

const Sidebar = () => {
  const [customPostTypes, setCustomPostTypes] = useState<PostType[]>([]);

  useEffect(() => {
    const loadPostTypes = async () => {
      try {
        const response = await getPostTypes();

        setCustomPostTypes(
          response.filter(
            (postType) => !postType.is_builtin && postType.is_active,
          ),
        );
      } catch (error) {
        console.log("POST TYPES ERROR:", error);
      }
    };

    loadPostTypes();
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>Smart Inventory</h2>

        <span>Admin Panel</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/admin/dashboard"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          <span>📊</span>
          Dashboard
        </NavLink>

        <NavLink
          to="/admin/users"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          <span>👥</span>
          Users
        </NavLink>

        <NavLink
          to="/admin/products"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          <span>📦</span>
          Products
        </NavLink>

        <NavLink
          to="/admin/media"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          <span>🖼️</span>
          Media
        </NavLink>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>📝</span>
            Content
          </div>

          <NavLink
            to="/admin/content"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <span>📝</span>
            Content
          </NavLink>

          <NavLink
            to="/admin/content/posts"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <span>📄</span>
            Posts
          </NavLink>

          <NavLink
            to="/admin/content/pages"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <span>📃</span>
            Pages
          </NavLink>

          {customPostTypes.map((postType) => (
            <NavLink
              key={postType.id}
              to={`/admin/content/${postType.slug}`}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span>{postType.icon || "📄"}</span>

              {postType.name}
            </NavLink>
          ))}

          <NavLink
            to="/admin/content/post-types"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <span>🧩</span>
            Post Types
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>🎨</span>
            Appearance
          </div>

          <NavLink
            to="/admin/appearance/menus"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <span>🧭</span>
            Menus
          </NavLink>

          <NavLink
            to="/admin/appearance/header-footer"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <span>🖼️</span>
            Header & Footer
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>⚙️</span>
            Settings
          </div>

          <NavLink
            to="/admin/settings/reading"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <span>📖</span>
            Reading
          </NavLink>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
