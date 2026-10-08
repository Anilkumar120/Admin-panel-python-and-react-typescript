import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getProduct,
  updateProduct,
} from "../../api/products";

import {
  getMediaUrl,
} from "../../api/media";

import type {
  MediaItem,
} from "../../api/media";

import MediaSelector from "../../components/Media/MediaSelector";


const EditProduct = () => {

  const navigate = useNavigate();

  const {
    productId,
  } = useParams();


  const [title, setTitle] = useState("");

  const [description, setDescription] = useState("");

  const [price, setPrice] = useState("");

  const [quantity, setQuantity] = useState("");

  const [category, setCategory] = useState("");

  const [brand, setBrand] = useState("");

  const [selectedMedia, setSelectedMedia] =
    useState<MediaItem | null>(null);

  const [isMediaSelectorOpen, setIsMediaSelectorOpen] =
    useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");


  useEffect(() => {

    const loadProduct = async () => {

      if (!productId) {
        setError("Product ID is missing.");

        setLoading(false);

        return;
      }

      try {

        setLoading(true);

        setError("");

        const product = await getProduct(productId);

        setTitle(product.name);

        setDescription(product.description);

        setPrice(String(product.price));

        setQuantity(String(product.quantity));

        setCategory(product.category);

        setBrand(product.brand || "");


        if (product.media_id) {

          setSelectedMedia({
            _id: product.media_id,
            file_name: product.image || "",
            original_name: product.image || "",
            title: product.name,
            alt_text: product.name,
            description: "",
            mime_type: "image",
            file_type: "image",
            extension: "",
            file_size: 0,
            url: product.image || "",
            is_deleted: false,
          });

        } else if (product.image) {

          setSelectedMedia({
            _id: "",
            file_name: product.image,
            original_name: product.image,
            title: product.name,
            alt_text: product.name,
            description: "",
            mime_type: "image",
            file_type: "image",
            extension: "",
            file_size: 0,
            url: product.image,
            is_deleted: false,
          });

        }

      } catch (error: any) {

        setError(
          error.response?.data?.detail ||
          "Failed to load product",
        );

      } finally {

        setLoading(false);

      }
    };


    loadProduct();

  }, [productId]);


  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {

    event.preventDefault();

    if (!productId) {
      return;
    }

    try {

      setSaving(true);

      setError("");


      await updateProduct(
        productId,
        title,
        description,
        Number(price),
        Number(quantity),
        category,
        brand,
        selectedMedia?._id || undefined,
      );


      navigate("/admin/products");

    } catch (error: any) {

      setError(
        error.response?.data?.detail ||
        "Failed to update product",
      );

    } finally {

      setSaving(false);

    }
  };


  if (loading) {

    return (
      <div className="products-page">

        <div className="table-card">

          <div className="table-message">
            Loading product...
          </div>

        </div>

      </div>
    );

  }


  return (
    <div className="products-page">

      <div className="page-heading">

        <div>

          <h1>Edit Product</h1>

          <p>
            Update your inventory product.
          </p>

        </div>

      </div>


      <div className="table-card">

        <form
          onSubmit={handleSubmit}
          className="product-form"
        >

          {error && (
            <div className="table-error">
              {error}
            </div>
          )}


          <div className="form-group">

            <label>
              Product Name
            </label>

            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="Enter product name"
              required
            />

          </div>


          <div className="form-group">

            <label>
              Description
            </label>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Enter product description"
              rows={5}
              required
            />

          </div>


          <div className="form-row">

            <div className="form-group">

              <label>
                Price
              </label>

              <input
                type="number"
                value={price}
                onChange={(event) =>
                  setPrice(event.target.value)
                }
                placeholder="Enter price"
                min="0"
                required
              />

            </div>


            <div className="form-group">

              <label>
                Quantity
              </label>

              <input
                type="number"
                value={quantity}
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
                placeholder="Enter quantity"
                min="0"
                required
              />

            </div>

          </div>


          <div className="form-row">

            <div className="form-group">

              <label>
                Category
              </label>

              <input
                type="text"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                placeholder="Enter category"
                required
              />

            </div>


            <div className="form-group">

              <label>
                Brand
              </label>

              <input
                type="text"
                value={brand}
                onChange={(event) =>
                  setBrand(event.target.value)
                }
                placeholder="Enter brand"
              />

            </div>

          </div>


          <div className="form-group">

            <label>
              Product Image
            </label>

            <div
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: "8px",
                padding: "20px",
                cursor: "pointer",
                textAlign: "center",
                minHeight: "150px",
              }}
              onClick={() =>
                setIsMediaSelectorOpen(true)
              }
            >

              {selectedMedia ? (

                <>

                  {selectedMedia.url && (

                    <img
                      src={getMediaUrl(
                        selectedMedia.url,
                      )}
                      alt={selectedMedia.title}
                      style={{
                        maxWidth: "180px",
                        maxHeight: "140px",
                        objectFit: "contain",
                      }}
                    />

                  )}

                  <p>
                    {selectedMedia.title ||
                      selectedMedia.original_name}
                  </p>

                  <small>
                    Click to change image
                  </small>

                </>

              ) : (

                <>

                  <p>
                    Product Image
                  </p>

                  <small>
                    Click to select image from Media Library
                  </small>

                </>

              )}

            </div>

          </div>


          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "20px",
            }}
          >

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Updating..."
                : "Update Product"}
            </button>


            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                navigate("/admin/products")
              }
              disabled={saving}
            >
              Cancel
            </button>

          </div>

        </form>

      </div>


      <MediaSelector
        isOpen={isMediaSelectorOpen}
        onClose={() =>
          setIsMediaSelectorOpen(false)
        }
        onSelect={(media) => {

          setSelectedMedia(media);

          setIsMediaSelectorOpen(false);

        }}
        selectedMediaId={
          selectedMedia?._id
        }
      />

    </div>
  );
};


export default EditProduct;