
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getProducts,
  deleteProduct,
  getImageUrl,
} from "../../api/products";

import type { Product } from "../../api/products";
import ProductImportExport from "../../components/admin/ProductImportExport";

const Products = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const limit = 12;

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getProducts(page, limit, search, category);

      setProducts(data.products);
      setTotal(data.total);
    } catch (error: any) {
      setError(
        error.response?.data?.detail || "Failed to load products",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [page, search, category]);

  // Remove selected IDs that no longer exist in the loaded product list.
  useEffect(() => {
    const currentIds = new Set(products.map((product) => product.id));

    setSelectedProducts((previous) =>
      previous.filter((id) => currentIds.has(id)),
    );
  }, [products]);

  const handleDelete = async (productId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to move this product to trash?",
    );

    if (!confirmed) return;

    try {
      await deleteProduct(productId);

      setSelectedProducts((previous) =>
        previous.filter((id) => id !== productId),
      );

      await loadProducts();
    } catch (error: any) {
      alert(
        error.response?.data?.detail || "Failed to delete product",
      );
    }
  };

  const allSelected =
    products.length > 0 &&
    products.every((product) =>
      selectedProducts.includes(product.id),
    );

  const handleSelectAll = (checked: boolean) => {
    const currentPageIds = products.map((product) => product.id);

    if (checked) {
      setSelectedProducts((previous) =>
        Array.from(new Set([...previous, ...currentPageIds])),
      );
    } else {
      setSelectedProducts((previous) =>
        previous.filter((id) => !currentPageIds.includes(id)),
      );
    }
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

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      alert("Please select at least one product.");
      return;
    }

    const idsToDelete = [...selectedProducts];

    const confirmed = window.confirm(
      `Are you sure you want to move ${idsToDelete.length} selected product(s) to Trash?`,
    );

    if (!confirmed) return;

    setBulkDeleting(true);

    const failedIds: string[] = [];
    let deletedCount = 0;

    try {
      for (const productId of idsToDelete) {
        try {
          await deleteProduct(productId);
          deletedCount++;
        } catch {
          failedIds.push(productId);
        }
      }

      setSelectedProducts(failedIds);

      await loadProducts();

      if (failedIds.length > 0) {
        alert(
          `${deletedCount} product(s) moved to Trash. ${failedIds.length} product(s) could not be deleted.`,
        );
      } else {
        alert(
          `${deletedCount} product(s) moved to Trash successfully.`,
        );
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    setSelectedProducts([]);
  };

  const handleCategory = (value: string) => {
    setCategory(value);
    setPage(1);
    setSelectedProducts([]);
  };

  const categories = Array.from(
    new Set(
      products
        .map((product) => product.category)
        .filter((item) => item),
    ),
  );

  return (
    <div className="products-page">
      <div className="page-heading">
        <div>
          <h1>Products</h1>
          <p>Manage your inventory products.</p>
        </div>

        <div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate("/admin/products/trash")}
          >
            Trash
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => navigate("/admin/products/create")}
          >
            + Add Product
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
          />

          <select
            value={category}
            onChange={(event) => handleCategory(event.target.value)}
          >
            <option value="">All Categories</option>

            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadProducts()}
            disabled={loading || bulkDeleting}
          >
            Refresh
          </button>
        </div>

        <ProductImportExport
          products={products}
          onImported={loadProducts}
        />

        {selectedProducts.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px",
              padding: "12px 0",
            }}
          >
            <span>
              <strong>{selectedProducts.length}</strong> product(s)
              selected
            </span>

            <button
              type="button"
              className="delete-button"
              onClick={() => void handleBulkDelete()}
              disabled={bulkDeleting || loading}
            >
              {bulkDeleting
                ? "Moving to Trash..."
                : "Move Selected to Trash"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedProducts([])}
              disabled={bulkDeleting}
            >
              Clear Selection
            </button>
          </div>
        )}

        {loading && (
          <div className="table-message">Loading products...</div>
        )}

        {error && <div className="table-error">{error}</div>}

        {!loading && !error && products.length === 0 && (
          <div className="table-message">No products found.</div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all products on this page"
                      checked={allSelected}
                      onChange={(event) =>
                        handleSelectAll(event.target.checked)
                      }
                      disabled={bulkDeleting}
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
                {products.map((product) => {
                  const imageUrl = product.image
                    ? getImageUrl(product.image)
                    : "";

                  return (
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
                          disabled={bulkDeleting}
                        />
                      </td>

                      <td>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
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
                            onClick={() =>
                              navigate(
                                `/admin/products/edit/${product.id}`,
                              )
                            }
                            disabled={bulkDeleting}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="delete-button"
                            onClick={() =>
                              void handleDelete(product.id)
                            }
                            disabled={bulkDeleting}
                          >
                            Trash
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={page === 1 || bulkDeleting}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>

            <span>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              className="secondary-button"
              disabled={page === totalPages || bulkDeleting}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
