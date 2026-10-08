import { useEffect, useRef, useState } from "react";

import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import { getImageUrl } from "../../api/profile";

import { getPostTypes, type PostType } from "../../api/content";

const AdminLayout = () => {
  const { user, logout } = useAuth();

  const location = useLocation();

  const navigate = useNavigate();

  const [postTypes, setPostTypes] = useState<PostType[]>([]);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    setIsUserMenuOpen(false);

    logout();

    navigate("/login");
  };

  const handleProfile = () => {
    setIsUserMenuOpen(false);

    navigate("/admin/profile");
  };

  const loadPostTypes = async () => {
    try {
      const response = await getPostTypes();

      setPostTypes(response);
    } catch (error) {
      console.log("SIDEBAR POST TYPES ERROR:", error);
    }
  };

  useEffect(() => {
    loadPostTypes();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const customPostTypes = postTypes.filter(
    (postType) => !postType.is_builtin && postType.is_active,
  );

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>Admin Panel</h2>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/admin/dashboard"
            className={
              location.pathname === "/admin/dashboard"
                ? "nav-link active"
                : "nav-link"
            }
          >
            <span>📊</span>
            Dashboard
          </Link>

          <Link
            to="/admin/profile"
            className={
              location.pathname === "/admin/profile"
                ? "nav-link active"
                : "nav-link"
            }
          >
            <span>👤</span>
            Profile
          </Link>

          <Link
            to="/admin/users"
            className={
              location.pathname.startsWith("/admin/users")
                ? "nav-link active"
                : "nav-link"
            }
          >
            <span>👥</span>
            Users
          </Link>

          <Link
            to="/admin/products"
            className={
              location.pathname.startsWith("/admin/products")
                ? "nav-link active"
                : "nav-link"
            }
          >
            <span>📦</span>
            Products
          </Link>

          <Link
            to="/admin/media"
            className={
              location.pathname.startsWith("/admin/media")
                ? "nav-link active"
                : "nav-link"
            }
          >
            <span>🖼️</span>
            Media
          </Link>

          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <span>📝</span>
              Content
            </div>

            <Link
              to="/admin/content"
              className={
                location.pathname === "/admin/content"
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>📋</span>
              Content Dashboard
            </Link>

            <Link
              to="/admin/content/posts"
              className={
                location.pathname.startsWith("/admin/content/posts")
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>📝</span>
              Posts
            </Link>

            <Link
              to="/admin/content/pages"
              className={
                location.pathname.startsWith("/admin/content/pages")
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>📄</span>
              Pages
            </Link>

            {customPostTypes.map((postType) => (
              <Link
                key={postType.id}
                to={`/admin/content/${postType.slug}`}
                className={
                  location.pathname.startsWith(
                    `/admin/content/${postType.slug}`,
                  )
                    ? "nav-link active"
                    : "nav-link"
                }
              >
                <span>{postType.icon || "📄"}</span>

                {postType.name}
              </Link>
            ))}

            <Link
              to="/admin/content/post-types"
              className={
                location.pathname.startsWith("/admin/content/post-types")
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>⚙️</span>
              Post Types
            </Link>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <span>🎨</span>
              Appearance
            </div>

            <Link
              to="/admin/appearance/menus"
              className={
                location.pathname.startsWith("/admin/appearance/menus")
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>🧭</span>
              Menus
            </Link>

            <Link
              to="/admin/appearance/header-footer"
              className={
                location.pathname.startsWith("/admin/appearance/header-footer")
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>🖼️</span>
              Header & Footer
            </Link>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <span>⚙️</span>
              Settings
            </div>

            <Link
              to="/admin/settings/reading"
              className={
                location.pathname.startsWith("/admin/settings")
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>📖</span>
              Reading
            </Link>
          </div>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h3>Admin Dashboard</h3>
          </div>

          <div className="header-user-wrapper" ref={userMenuRef}>
            <button
              type="button"
              className="header-user"
              onClick={() => setIsUserMenuOpen((current) => !current)}
            >
              <div className="header-user-image-wrapper">
                {user?.profile_image ? (
                  <img
                    src={getImageUrl(user.profile_image)}
                    alt="Profile"
                    className="header-user-image"
                  />
                ) : (
                  <div className="header-user-placeholder">
                    {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
              </div>

              <div className="header-user-info">
                <strong>{user?.name || "User"}</strong>

                <small>{user?.role || "subscriber"}</small>
              </div>

              <span
                className={
                  isUserMenuOpen
                    ? "header-user-arrow open"
                    : "header-user-arrow"
                }
              >
                ▾
              </span>
            </button>

            {isUserMenuOpen && (
              <div className="header-user-dropdown">
                <div className="header-dropdown-user">
                  <div className="header-dropdown-image-wrapper">
                    {user?.profile_image ? (
                      <img
                        src={getImageUrl(user.profile_image)}
                        alt="Profile"
                        className="header-dropdown-image"
                      />
                    ) : (
                      <div className="header-dropdown-placeholder">
                        {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                  </div>

                  <div>
                    <strong>{user?.name || "User"}</strong>

                    <small>{user?.email || ""}</small>
                  </div>
                </div>

                <div className="header-dropdown-divider" />

                <button
                  type="button"
                  className="header-dropdown-item"
                  onClick={handleProfile}
                >
                  <span>👤</span>
                  Profile
                </button>

                <button
                  type="button"
                  className="header-dropdown-item logout"
                  onClick={handleLogout}
                >
                  <span>🚪</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <section className="admin-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
};

export default AdminLayout;
