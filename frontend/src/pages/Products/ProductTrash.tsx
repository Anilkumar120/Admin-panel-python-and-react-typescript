
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
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem("access_token");
    return { Authorization: `Bearer ${token}` };
  };

  const loadTrashProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${API_URL}/api/products/trash`,
        { headers: getHeaders() },
      );

      setProducts(response.data.products || []);
    } catch (error: any) {
      setError(
        error.response?.data?.detail || "Failed to load trash products",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrashProducts();
  }, []);

  useEffect(() => {
    const currentIds = new Set(products.map((product) => product.id));

    setSelectedProducts((previous) =>
      previous.filter((id) => currentIds.has(id)),
    );
  }, [products]);

  const allSelected =
    products.length > 0 &&
    products.every((product) =>
      selectedProducts.includes(product.id),
    );

  const handleSelectAll = (checked: boolean) => {
    setSelectedProducts(
      checked ? products.map((product) => product.id) : [],
    );
  };

  const handleSelectProduct = (
    productId: string,
    checked: boolean,
  ) => {
    setSelectedProducts((previous) =>
      checked
        ? Array.from(new Set([...previous, productId]))
        : previous.filter((id) => id !== productId),
    );
  };

  const handleRestore = async (productId: string) => {
    if (
      !window.confirm("Are you sure you want to restore this product?")
    ) {
      return;
    }

    try {
      setProcessing(true);
      await restoreProduct(productId);

      setSelectedProducts((previous) =>
        previous.filter((id) => id !== productId),
      );

      await loadTrashProducts();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to restore product");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedProducts.length === 0) {
      alert("Please select at least one product.");
      return;
    }

    const idsToRestore = [...selectedProducts];

    if (
      !window.confirm(
        `Restore all ${idsToRestore.length} selected product(s)?`,
      )
    ) {
      return;
    }

    setProcessing(true);

    let restoredCount = 0;
    const failedIds: string[] = [];

    try {
      for (const productId of idsToRestore) {
        try {
          await restoreProduct(productId);
          restoredCount++;
        } catch {
          failedIds.push(productId);
        }
      }

      setSelectedProducts(failedIds);
      await loadTrashProducts();

      if (failedIds.length > 0) {
        alert(
          `${restoredCount} product(s) restored. ${failedIds.length} failed.`,
        );
      } else {
        alert(`${restoredCount} product(s) restored successfully.`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = async (productId: string) => {
    if (
      !window.confirm(
        "Permanently delete this product? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setProcessing(true);
      await permanentDeleteProduct(productId);

      setSelectedProducts((previous) =>
        previous.filter((id) => id !== productId),
      );

      await loadTrashProducts();
    } catch (error: any) {
      alert(
        error.response?.data?.detail ||
          "Failed to permanently delete product",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedProducts.length === 0) {
      alert("Please select at least one product.");
      return;
    }

    const idsToDelete = [...selectedProducts];

    if (
      !window.confirm(
        `Permanently delete ${idsToDelete.length} selected product(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setProcessing(true);

    let deletedCount = 0;
    const failedIds: string[] = [];

    try {
      for (const productId of idsToDelete) {
        try {
          await permanentDeleteProduct(productId);
          deletedCount++;
        } catch {
          failedIds.push(productId);
        }
      }

      setSelectedProducts(failedIds);
      await loadTrashProducts();

      if (failedIds.length > 0) {
        alert(
          `${deletedCount} product(s) permanently deleted. ${failedIds.length} failed.`,
        );
      } else {
        alert(`${deletedCount} product(s) permanently deleted.`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (products.length === 0) {
      alert("Trash is already empty.");
      return;
    }

    if (
      !window.confirm(
        `Permanently delete ALL ${products.length} product(s) currently shown in Trash? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setProcessing(true);

    let deletedCount = 0;
    const failedIds: string[] = [];

    try {
      for (const product of products) {
        try {
          await permanentDeleteProduct(product.id);
          deletedCount++;
        } catch {
          failedIds.push(product.id);
        }
      }

      setSelectedProducts(failedIds);
      await loadTrashProducts();

      if (failedIds.length > 0) {
        alert(
          `${deletedCount} product(s) deleted. ${failedIds.length} failed.`,
        );
      } else {
        alert("Trash emptied successfully.");
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="products-page">
      <div className="page-heading">
        <div>
          <h1>Product Trash</h1>
          <p>Manage deleted inventory products.</p>
        </div>

        <div className="action-buttons">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate("/admin/products")}
            disabled={processing}
          >
            Back to Products
          </button>

          <button
            type="button"
            className="delete-button"
            onClick={() => void handleEmptyTrash()}
            disabled={processing || loading || products.length === 0}
          >
            {processing ? "Processing..." : "Empty Trash"}
          </button>
        </div>
      </div>

      <div className="table-card">
        {!loading && !error && products.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              padding: "12px 0",
            }}
          >
            <span>{selectedProducts.length} product(s) selected</span>

            <button
              type="button"
              className="status-button"
              onClick={() => void handleBulkRestore()}
              disabled={processing || selectedProducts.length === 0}
            >
              Restore Selected
            </button>

            <button
              type="button"
              className="delete-button"
              onClick={() => void handleBulkPermanentDelete()}
              disabled={processing || selectedProducts.length === 0}
            >
              Delete Selected Permanently
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedProducts([])}
              disabled={processing || selectedProducts.length === 0}
            >
              Clear Selection
            </button>
          </div>
        )}

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
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all trash products"
                      checked={allSelected}
                      onChange={(event) =>
                        handleSelectAll(event.target.checked)
                      }
                      disabled={processing}
                    />
                  </th>
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
                      <input
                        type="checkbox"
                        aria-label={`Select ${product.name}`}
                        checked={selectedProducts.includes(product.id)}
                        onChange={(event) =>
                          handleSelectProduct(
                            product.id,
                            event.target.checked,
                          )
                        }
                        disabled={processing}
                      />
                    </td>

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
                          onClick={() => void handleRestore(product.id)}
                          disabled={processing}
                        >
                          Restore
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() =>
                            void handlePermanentDelete(product.id)
                          }
                          disabled={processing}
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
