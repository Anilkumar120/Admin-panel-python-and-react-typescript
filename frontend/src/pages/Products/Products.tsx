import { useEffect, useState } from "react"; 
 
import { useNavigate } from "react-router-dom"; 
 
import { getProducts, deleteProduct, getImageUrl } from "../../api/products"; 
 
import type { Product } from "../../api/products"; 
 
const Products = () => { 
  const navigate = useNavigate(); 
 
  const [products, setProducts] = useState<Product[]>([]); 
 
  const [loading, setLoading] = useState(true); 
 
  const [error, setError] = useState(""); 
 
  const [search, setSearch] = useState(""); 
 
  const [category, setCategory] = useState(""); 
 
  const [page, setPage] = useState(1); 
 
  const [total, setTotal] = useState(0); 
 
  const limit = 12; 
 
  const loadProducts = async () => { 
    try { 
      setLoading(true); 
 
      setError(""); 
 
      const data = await getProducts(page, limit, search, category); 
 
      setProducts(data.products); 
 
      setTotal(data.total); 
    } catch (error: any) { 
      setError(error.response?.data?.detail || "Failed to load products"); 
    } finally { 
      setLoading(false); 
    } 
  }; 
 
  useEffect(() => { 
    loadProducts(); 
  }, [page, search, category]); 
 
  const handleDelete = async (productId: string) => { 
    const confirmed = window.confirm( 
      "Are you sure you want to move this product to trash?", 
    ); 
 
    if (!confirmed) { 
      return; 
    } 
 
    try { 
      await deleteProduct(productId); 
 
      await loadProducts(); 
    } catch (error: any) { 
      alert(error.response?.data?.detail || "Failed to delete product"); 
    } 
  }; 
 
  const totalPages = Math.ceil(total / limit); 
 
  const handleSearch = (value: string) => { 
    setSearch(value); 
 
    setPage(1); 
  }; 
 
  const handleCategory = (value: string) => { 
    setCategory(value); 
 
    setPage(1); 
  }; 
 
  const categories = Array.from( 
    new Set(products.map((product) => product.category).filter((item) => item)), 
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
            onClick={loadProducts} 
          > 
            Refresh 
          </button> 
        </div> 
 
        {loading && <div className="table-message">Loading products...</div>} 
 
        {error && <div className="table-error">{error}</div>} 
 
        {!loading && !error && products.length === 0 && ( 
          <div className="table-message">No products found.</div> 
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
                {products.map((product) => { 
                  const imageUrl = product.image 
                    ? getImageUrl(product.image) 
                    : ""; 
 
                  return ( 
                    <tr key={product.id}> 
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
                            onClick={() => 
                              navigate(`/admin/products/edit/${product.id}`) 
                            } 
                          > 
                            Edit 
                          </button> 
 
                          <button 
                            type="button" 
                            className="delete-button" 
                            onClick={() => handleDelete(product.id)} 
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
              disabled={page === 1} 
              onClick={() => setPage(page - 1)} 
            > 
              Previous 
            </button> 
 
            <span> 
              Page {page} of {totalPages} 
            </span> 
 
            <button 
              type="button" 
              className="secondary-button" 
              disabled={page === totalPages} 
              onClick={() => setPage(page + 1)} 
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