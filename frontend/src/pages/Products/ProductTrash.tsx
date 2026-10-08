import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import axios from "axios";

import { API_URL } from "../../api/config";

import {
  getImageUrl,
  restoreProduct,
  permanentDeleteProduct,
} from "../../api/products";

import type { Product } from "../../api/products";

const ProductTrash = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const getHeaders = () => {
    const token = localStorage.getItem("access_token");

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const loadTrashProducts = async () => {
    try {
      setLoading(true);

      setError("");

      const response = await axios.get(`${API_URL}/api/products/trash`, {
        headers: getHeaders(),
      });

      setProducts(response.data.products || []);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to load trash products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrashProducts();
  }, []);

  const handleRestore = async (productId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to restore this product?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await restoreProduct(productId);

      await loadTrashProducts();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to restore product");
    }
  };

  const handlePermanentDelete = async (productId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this product? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    try {
      await permanentDeleteProduct(productId);

      await loadTrashProducts();
    } catch (error: any) {
      alert(
        error.response?.data?.detail || "Failed to permanently delete product",
      );
    }
  };

  return (
    <div className="products-page">
      <div className="page-heading">
        <div>
          <h1>Product Trash</h1>

          <p>Manage deleted inventory products.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate("/admin/products")}
        >
          Back to Products
        </button>
      </div>

      <div className="table-card">
        {loading && (
          <div className="table-message">Loading trash products...</div>
        )}

        {error && <div className="table-error">{error}</div>}

        {!loading && !error && products.length === 0 && (
          <div className="table-message">Trash is empty.</div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>

                  <th>Product</th>

                  <th>Price</th>

                  <th>Quantity</th>

                  <th>Category</th>

                  <th>Brand</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {product.image ? (
                        <img
                          src={getImageUrl(product.image)}
                          alt={product.name}
                          className="product-image"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <span>No Image</span>
                      )}
                    </td>

                    <td>
                      <strong>{product.name}</strong>

                      <small className="product-description">
                        {product.description}
                      </small>
                    </td>

                    <td>₹{product.price}</td>

                    <td>{product.quantity}</td>

                    <td>{product.category}</td>

                    <td>{product.brand || "-"}</td>

                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="status-button"
                          onClick={() => handleRestore(product.id)}
                        >
                          Restore
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handlePermanentDelete(product.id)}
                        >
                          Delete Permanently
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductTrash;
