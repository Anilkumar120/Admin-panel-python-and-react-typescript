import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { getImageUrl } from "../../api/profile";
import { getPostTypes, type PostType } from "../../api/content";

const normalizePostTypes = (response: unknown): PostType[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === "object") {
    const data = response as Record<string, unknown>;

    for (const key of ["items", "post_types", "data"]) {
      if (Array.isArray(data[key])) {
        return data[key] as PostType[];
      }
    }
  }

  return [];
};

const AdminLayout = () => {
  const { user, logout } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const [postTypes, setPostTypes] = useState<PostType[]>([]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [profileImageFailed, setProfileImageFailed] = useState(false);

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

  const loadPostTypes = useCallback(async () => {
    try {
      const response = await getPostTypes();
      setPostTypes(normalizePostTypes(response));
    } catch (error) {
      console.error("SIDEBAR POST TYPES ERROR:", error);
      setPostTypes([]);
    }
  }, []);

  useEffect(() => {
    void loadPostTypes();
  }, [loadPostTypes]);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setProfileImageFailed(false);
  }, [user?.profile_image]);

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

  const profileImageUrl = user?.profile_image
    ? getImageUrl(user.profile_image)
    : "";

  const showProfileImage = Boolean(profileImageUrl) && !profileImageFailed;

  const userInitial = user?.name?.trim()
    ? user.name.trim().charAt(0).toUpperCase()
    : "U";

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
              location.pathname.startsWith("/admin/profile")
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

          <div className="sidebar-section products-sidebar-section">
            <Link
              to="/admin/products"
              className={
                location.pathname.startsWith("/admin/products") ||
                location.pathname.startsWith("/admin/orders")
                  ? "sidebar-section-title active"
                  : "sidebar-section-title"
              }
            >
              <span>📦</span>
              Products
            </Link>
            <div className="products-submenu">
              <Link to="/admin/products" className={`nav-link${location.pathname === "/admin/products" ? " active" : ""}`}><span>▦</span>All Products</Link>
              <Link to="/admin/products/create" className={`nav-link${location.pathname === "/admin/products/create" ? " active" : ""}`}><span>＋</span>Add New Product</Link>
              <Link to="/admin/products/categories" className={`nav-link${location.pathname === "/admin/products/categories" ? " active" : ""}`}><span>▤</span>Categories</Link>
              <Link to="/admin/products/tags" className={`nav-link${location.pathname === "/admin/products/tags" ? " active" : ""}`}><span>#</span>Tags</Link>
              <Link to="/admin/products/attributes" className={`nav-link${location.pathname === "/admin/products/attributes" ? " active" : ""}`}><span>⚙</span>Attributes</Link>
              <Link to="/admin/products/brands" className={`nav-link${location.pathname === "/admin/products/brands" ? " active" : ""}`}><span>◆</span>Brands</Link>
              <Link to="/admin/appearance/header-footer?template=single_product" className={`nav-link${location.pathname === "/admin/appearance/header-footer" ? " active" : ""}`}><span>▣</span>Single Product Template</Link>
              <Link to="/admin/orders" className={`nav-link${location.pathname === "/admin/orders" ? " active" : ""}`}><span>🧾</span>Orders</Link>
              <Link to="/admin/orders/trash" className={`nav-link${location.pathname === "/admin/orders/trash" ? " active" : ""}`}><span>🗑</span>Trash Orders</Link>
              <Link to="/admin/products/trash" className={`nav-link${location.pathname === "/admin/products/trash" ? " active" : ""}`}><span>🗑</span>Trash Products</Link>
            </div>
          </div>

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

            {/* ✅ NEW: Page Builder Link */}
            <Link
              to="/admin/appearance/page-builder"
              className={
                location.pathname.startsWith("/admin/appearance/page-builder")
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>🏗️</span>
              Page Builder
            </Link>
            {/* ✅ END NEW */}

            {/* ✅ NEW: Header & Footer Link */}
            <Link
              to="/admin/appearance/header-footer"
              className={
                location.pathname.startsWith("/admin/appearance/header-footer")
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>🔝</span>
              Header &amp; Footer
            </Link>
            {/* ✅ END NEW */}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <span>⚙️</span>
              Settings
            </div>

            <Link
              to="/admin/settings/reading"
              className={
                location.pathname === "/admin/settings/reading"
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>📖</span>
              Reading
            </Link>
            <Link
              to="/admin/settings/site-identity"
              className={
                location.pathname === "/admin/settings/site-identity"
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span>🖼️</span>
              Site Identity
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
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
              onClick={() => setIsUserMenuOpen((current) => !current)}
            >
              <div className="header-user-image-wrapper">
                {showProfileImage ? (
                  <img
                    key={profileImageUrl}
                    src={profileImageUrl}
                    alt="Profile"
                    className="header-user-image"
                    onError={() => setProfileImageFailed(true)}
                  />
                ) : (
                  <div className="header-user-placeholder">{userInitial}</div>
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
                    {showProfileImage ? (
                      <img
                        key={profileImageUrl}
                        src={profileImageUrl}
                        alt="Profile"
                        className="header-dropdown-image"
                        onError={() => setProfileImageFailed(true)}
                      />
                    ) : (
                      <div className="header-dropdown-placeholder">
                        {userInitial}
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
