import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/Layout/AdminLayout";
import SiteIdentityMeta from "./components/Layout/SiteIdentityMeta";

// ============ ADMIN PAGES ============
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import Dashboard from "./pages/Dashboard/Dashboard";
import Profile from "./pages/Profile/Profile";
import Users from "./pages/Users/Users";
import CreateUser from "./pages/Users/CreateUser";
import EditUser from "./pages/Users/EditUser";
import Products from "./pages/Products/Products";
import CreateProduct from "./pages/Products/CreateProduct";
import EditProduct from "./pages/Products/EditProduct";
import ProductTrash from "./pages/Products/ProductTrash";
import ProductTerms from "./pages/Products/ProductTerms";
import Orders from "./pages/Products/Orders";
import ContentDashboard from "./pages/Content/ContentDashboard";
import PostTypes from "./pages/Content/PostTypes";
import CreatePostType from "./pages/Content/CreatePostType";
import EditPostType from "./pages/Content/EditPostType";
import PostTypeFields from "./pages/Content/PostTypeFields";
import CustomPostTypeContent from "./pages/Content/CustomPostTypeContent";
import Reading from "./pages/Settings/Reading";
import SiteIdentity from "./pages/Settings/SiteIdentity";
import Categories from "./pages/Content/Categories";
import Tags from "./pages/Content/Tags";
import CreateContent from "./pages/Content/CreateContent";
import EditContent from "./pages/Content/EditContent";
import ContentTrash from "./pages/Content/ContentTrash";
import FormSubmissions from "./pages/Content/FormSubmissions";
import Menus from "./pages/Appearance/Menus/Menus";
import CreateMenu from "./pages/Appearance/Menus/CreateMenu";
import EditMenu from "./pages/Appearance/Menus/EditMenu";
import MediaLibrary from "./pages/Media/MediaLibrary";
import MediaTrash from "./pages/Media/MediaTrash";
import PageBuilder from "./pages/admin/PageBuilder";
import HeaderFooterList from "./pages/admin/HeaderFooterList";
import HeaderFooterBuilder from "./pages/admin/HeaderFooterBuilder";

// ============ PUBLIC PAGES ============
import PublicLayout from "./components/Layout/PublicLayout";
import PublicPageView from "./pages/admin/PublicPageView";
import HomePage from "./pages/admin/HomePage";
import Storefront from "./pages/Storefront/Storefront";

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SiteIdentityMeta />
        <Routes>
          {/* ================================================== */}
          {/* ============ 1. ADMIN AUTH ROUTES ================ */}
          {/* ================================================== */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/register" element={<Register />} />
          <Route path="/admin/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />

          {/* ================================================== */}
          {/* ============ 2. ADMIN DASHBOARD ================== */}
          {/* ================================================== */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />

            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />

            <Route path="users" element={<Users />} />
            <Route path="users/create" element={<CreateUser />} />
            <Route path="users/:userId/edit" element={<EditUser />} />

            <Route path="products" element={<Products />} />
            <Route path="products/create" element={<CreateProduct />} />
            <Route path="products/edit/:productId" element={<EditProduct />} />
            <Route path="products/trash" element={<ProductTrash />} />
            <Route path="products/categories" element={<ProductTerms termType="categories" />} />
            <Route path="products/tags" element={<ProductTerms termType="tags" />} />
            <Route path="products/attributes" element={<ProductTerms termType="attributes" />} />
            <Route path="products/brands" element={<ProductTerms termType="brands" />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:view" element={<Orders />} />

            <Route path="content" element={<ContentDashboard />} />
            <Route path="content/form-submissions" element={<FormSubmissions />} />
            <Route path="content/post-types" element={<PostTypes />} />
            <Route
              path="content/post-types/create"
              element={<CreatePostType />}
            />
            <Route
              path="content/post-types/:postTypeId/edit"
              element={<EditPostType />}
            />
            <Route
              path="content/post-types/:postTypeId/fields"
              element={<PostTypeFields />}
            />
            <Route
              path="content/:postTypeSlug"
              element={<CustomPostTypeContent />}
            />

            <Route path="settings/reading" element={<Reading />} />
            <Route path="settings/site-identity" element={<SiteIdentity />} />
            <Route
              path="content/:postTypeSlug/categories"
              element={<Categories />}
            />
            <Route path="content/:postTypeSlug/tags" element={<Tags />} />
            <Route
              path="content/:postTypeSlug/create"
              element={<CreateContent />}
            />
            <Route
              path="content/:postTypeSlug/:itemId/edit"
              element={<EditContent />}
            />
            <Route
              path="content/:postTypeSlug/trash"
              element={<ContentTrash />}
            />

            <Route path="appearance/menus" element={<Menus />} />
            <Route path="appearance/menus/create" element={<CreateMenu />} />
            <Route
              path="appearance/menus/:menuId/edit"
              element={<EditMenu />}
            />

            <Route path="media" element={<MediaLibrary />} />
            <Route path="media/trash" element={<MediaTrash />} />
            <Route path="appearance/page-builder" element={<PageBuilder />} />
            <Route
              path="appearance/header-footer"
              element={<HeaderFooterList />}
            />
            <Route
              path="appearance/header-footer/edit"
              element={<HeaderFooterBuilder />}
            />
          </Route>

          {/* ================================================== */}
          {/* ============ 3. LEGACY REDIRECTS ================= */}
          {/* ================================================== */}
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route
            path="/register"
            element={<Navigate to="/admin/register" replace />}
          />
          <Route
            path="/forgot-password"
            element={<Navigate to="/admin/forgot-password" replace />}
          />
          <Route
            path="/reset-password"
            element={<Navigate to="/admin/reset-password" replace />}
          />

          {/* ================================================== */}
          {/* ============ 4. PUBLIC ROUTES (LAST) ============= */}
          {/* ================================================== */}
          <Route element={<PublicLayout />}>
            {/* 🏠 Homepage — dynamic based on Reading settings */}
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<Storefront page="shop" />} />
            <Route path="/cart" element={<Storefront page="cart" />} />
            <Route path="/checkout" element={<Storefront page="checkout" />} />
            <Route path="/order-received" element={<Storefront page="received" />} />

            {/* Root-level slugs: /about, /my-post, /iphone-15 */}
            <Route path="/:slug" element={<PublicPageView />} />

            {/* Deeper paths: /category/tech, /tag/news */}
            <Route path="/:postType/:slug" element={<PublicPageView />} />
          </Route>

          {/* ================================================== */}
          {/* ============ 5. 404 FALLBACK ===================== */}
          {/* ================================================== */}
          <Route
            path="*"
            element={
              <div
                style={{
                  padding: 80,
                  textAlign: "center",
                  fontFamily: "Arial, sans-serif",
                  minHeight: "60vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <h1 style={{ fontSize: 64, color: "#0c2f55", margin: 0 }}>
                  404
                </h1>
                <p style={{ color: "#666", fontSize: 18, marginTop: 12 }}>
                  Page not found
                </p>
                <a
                  href="/"
                  style={{
                    color: "#0c2f55",
                    textDecoration: "underline",
                    marginTop: 24,
                    display: "inline-block",
                    fontSize: 15,
                  }}
                >
                  ← Back to Home
                </a>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;