import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/Layout/AdminLayout";
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
import ContentDashboard from "./pages/Content/ContentDashboard";
import PostTypes from "./pages/Content/PostTypes";
import CreatePostType from "./pages/Content/CreatePostType";
import EditPostType from "./pages/Content/EditPostType";
import PostTypeFields from "./pages/Content/PostTypeFields";
import CustomPostTypeContent from "./pages/Content/CustomPostTypeContent";
import Reading from "./pages/Settings/Reading";
import Categories from "./pages/Content/Categories";
import Tags from "./pages/Content/Tags";
import CreateContent from "./pages/Content/CreateContent";
import EditContent from "./pages/Content/EditContent";
import ContentTrash from "./pages/Content/ContentTrash";
import Menus from "./pages/Appearance/Menus/Menus";
import CreateMenu from "./pages/Appearance/Menus/CreateMenu";
import EditMenu from "./pages/Appearance/Menus/EditMenu";
import HeaderFooter from "./pages/Appearance/HeaderFooter/HeaderFooter";
import CreateHeaderFooter from "./pages/Appearance/HeaderFooter/CreateHeaderFooter";
import EditHeaderFooter from "./pages/Appearance/HeaderFooter/EditHeaderFooter";
import MediaLibrary from "./pages/Media/MediaLibrary";
import MediaTrash from "./pages/Media/MediaTrash";
import PageBuilder from "./pages/admin/PageBuilder";

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

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

            <Route path="content" element={<ContentDashboard />} />
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
            <Route path="appearance/header-footer" element={<HeaderFooter />} />

            <Route
              path="appearance/header-footer/create"
              element={<CreateHeaderFooter />}
            />

            <Route
              path="appearance/header-footer/:templateId/edit"
              element={<EditHeaderFooter />}
            />
            <Route path="media" element={<MediaLibrary />} />
            <Route path="media/trash" element={<MediaTrash />} />
            <Route path="appearance/page-builder" element={<PageBuilder />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
