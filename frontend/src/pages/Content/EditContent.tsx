import { useEffect, useState, type FormEvent } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  createCategory,
  createTag,
  getCategories,
  getContentItem,
  getPages,
  getPostTypeBySlug,
  getTags,
  updateContent,
  type Category,
  type ContentItem,
  type PostType,
  type Tag,
} from "../../api/content";

import { getMediaUrl, type MediaItem } from "../../api/media";

import MediaSelector from "../../components/Media/MediaSelector";

const EditContent = () => {
  const navigate = useNavigate();

  const { postTypeSlug, itemId } = useParams();

  const [postType, setPostType] = useState<PostType | null>(null);

  const [item, setItem] = useState<ContentItem | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  const [tags, setTags] = useState<Tag[]>([]);

  const [pages, setPages] = useState<ContentItem[]>([]);

  const [title, setTitle] = useState("");

  const [slug, setSlug] = useState("");

  const [content, setContent] = useState("");

  const [featuredImage, setFeaturedImage] = useState("");

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);

  const [parentId, setParentId] = useState("");

  const [status, setStatus] = useState("draft");

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [metaTitle, setMetaTitle] = useState("");

  const [metaDescription, setMetaDescription] = useState("");

  const [focusKeyword, setFocusKeyword] = useState("");

  const [canonicalUrl, setCanonicalUrl] = useState("");

  const [robots, setRobots] = useState("index,follow");

  const [ogTitle, setOgTitle] = useState("");

  const [ogDescription, setOgDescription] = useState("");

  const [ogImage, setOgImage] = useState("");

  const [twitterTitle, setTwitterTitle] = useState("");

  const [twitterDescription, setTwitterDescription] = useState("");

  const [twitterImage, setTwitterImage] = useState("");

  const [schemaType, setSchemaType] = useState("Article");

  const [showAddCategory, setShowAddCategory] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");

  const [newCategorySlug, setNewCategorySlug] = useState("");

  const [newCategoryParentId, setNewCategoryParentId] = useState("");

  const [addingCategory, setAddingCategory] = useState(false);

  const [showAddTag, setShowAddTag] = useState(false);

  const [newTagName, setNewTagName] = useState("");

  const [newTagSlug, setNewTagSlug] = useState("");

  const [addingTag, setAddingTag] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const createSlug = (value: string) => {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        setError("");

        if (!postTypeSlug || !itemId) {
          setError("Invalid content URL.");

          return;
        }

        const postTypeResponse = await getPostTypeBySlug(postTypeSlug);

        const itemResponse = await getContentItem(itemId);

        setPostType(postTypeResponse);

        setItem(itemResponse);

        setTitle(itemResponse.title || "");

        setSlug(itemResponse.slug || "");

        setContent(itemResponse.content || "");

        setFeaturedImage(itemResponse.featured_image || "");

        if (itemResponse.featured_image_id) {
          setSelectedMedia({
            _id: itemResponse.featured_image_id,

            file_name: itemResponse.featured_image || "",

            original_name: itemResponse.featured_image || "",

            title: itemResponse.title || "",

            alt_text: itemResponse.title || "",

            description: "",

            mime_type: "image",

            file_type: "image",

            extension: "",

            file_size: 0,

            url: itemResponse.featured_image || "",

            is_deleted: false,
          });
        }

        setParentId(itemResponse.parent_id || "");

        setStatus(itemResponse.status || "draft");

        setSelectedCategories(itemResponse.categories || []);

        setSelectedTags(itemResponse.tags || []);

        const seo = itemResponse.seo || {};

        setMetaTitle(seo.title || "");

        setMetaDescription(seo.description || "");

        setFocusKeyword(seo.focus_keyword || "");

        setCanonicalUrl(seo.canonical_url || "");

        setRobots(seo.robots || "index,follow");

        setOgTitle(seo.og_title || "");

        setOgDescription(seo.og_description || "");

        setOgImage(seo.og_image || "");

        setTwitterTitle(seo.twitter_title || "");

        setTwitterDescription(seo.twitter_description || "");

        setTwitterImage(seo.twitter_image || "");

        setSchemaType(seo.schema_type || "Article");

        if (postTypeResponse.features?.categories) {
          const categoryResponse = await getCategories(postTypeSlug);

          setCategories(categoryResponse);
        }

        if (postTypeResponse.features?.tags) {
          const tagResponse = await getTags(postTypeSlug);

          setTags(tagResponse);
        }

        if (postTypeResponse.features?.parent_page) {
          const pageResponse = await getPages(false, true);

          setPages(
            pageResponse.filter(
              (page: ContentItem) =>
                page.id !== itemId && page.status === "published",
            ),
          );
        }
      } catch (err) {
        console.error(err);

        setError("Failed to load content.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [postTypeSlug, itemId]);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategories((current) => {
      if (current.includes(categoryId)) {
        return current.filter((id) => id !== categoryId);
      }

      return [...current, categoryId];
    });
  };

  const handleTagChange = (tagId: string) => {
    setSelectedTags((current) => {
      if (current.includes(tagId)) {
        return current.filter((id) => id !== tagId);
      }

      return [...current, tagId];
    });
  };

  const handleAddCategory = async () => {
    if (!postTypeSlug || !newCategoryName.trim()) {
      return;
    }

    try {
      setAddingCategory(true);

      setError("");

      const response = await createCategory(
        postTypeSlug,
        newCategoryName.trim(),
        newCategorySlug.trim() || createSlug(newCategoryName),
        newCategoryParentId || "",
      );

      const categoryResponse = await getCategories(postTypeSlug);

      setCategories(categoryResponse);

      const createdId = response?.id || response?.category?.id;

      if (createdId) {
        setSelectedCategories((current) => [...current, createdId]);
      }

      setNewCategoryName("");

      setNewCategorySlug("");

      setNewCategoryParentId("");

      setShowAddCategory(false);
    } catch (err) {
      console.error(err);

      setError("Failed to create category.");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleAddTag = async () => {
    if (!postTypeSlug || !newTagName.trim()) {
      return;
    }

    try {
      setAddingTag(true);

      setError("");

      const response = await createTag(
        postTypeSlug,
        newTagName.trim(),
        newTagSlug.trim() || createSlug(newTagName),
      );

      const tagResponse = await getTags(postTypeSlug);

      setTags(tagResponse);

      const createdId = response?.id || response?.tag?.id;

      if (createdId) {
        setSelectedTags((current) => [...current, createdId]);
      }

      setNewTagName("");

      setNewTagSlug("");

      setShowAddTag(false);
    } catch (err) {
      console.error(err);

      setError("Failed to create tag.");
    } finally {
      setAddingTag(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!itemId || !postTypeSlug) {
      return;
    }

    try {
      setSaving(true);

      setError("");

      const data: Record<string, string> = {};

      data.title = title.trim();

      data.slug = slug.trim();

      data.content = content;

      data.featured_image = selectedMedia?.url || featuredImage.trim();

      data.featured_image_id = selectedMedia?._id || "";

      data.status = status;

      data.categories = selectedCategories.join(",");

      data.tags = selectedTags.join(",");

      data.parent_id = parentId || "";

      data.seo_title = metaTitle.trim();

      data.seo_description = metaDescription.trim();

      data.focus_keyword = focusKeyword.trim();

      data.canonical_url = canonicalUrl.trim();

      data.robots = robots.trim();

      data.og_title = ogTitle.trim();

      data.og_description = ogDescription.trim();

      data.og_image = ogImage.trim();

      data.twitter_title = twitterTitle.trim();

      data.twitter_description = twitterDescription.trim();

      data.twitter_image = twitterImage.trim();

      data.schema_type = schemaType;

      await updateContent(itemId, data);

      navigate(`/admin/content/${postTypeSlug}`);
    } catch (err: any) {
      console.error(err);

      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(
          detail
            .map((item: any) => {
              const location = Array.isArray(item?.loc)
                ? item.loc.join(" → ")
                : "";

              return location
                ? `${location}: ${item?.msg || "Validation error."}`
                : item?.msg || "Validation error.";
            })
            .join(", "),
        );
      } else {
        setError(detail || "Failed to update content.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="content-page">
        <div className="content-card">
          <p>Loading content...</p>
        </div>
      </div>
    );
  }

  if (!item || !postType) {
    return (
      <div className="content-page">
        <div className="content-card">
          <p>{error || "Content not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="content-card-header">
        <div>
          <h1>Edit {postType.name}</h1>

          <p>Update your {postType.name.toLowerCase()}.</p>
        </div>
      </div>

      {error && <div className="content-message-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="content-grid">
          <div>
            <div className="content-card">
              <div className="content-card-header">
                <div>
                  <h2>Content</h2>
                </div>
              </div>

              <div className="form-group">
                <label>Title</label>

                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Slug</label>

                <input
                  type="text"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Content</label>

                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={18}
                />
              </div>

              <div className="form-group">
                <label>Status</label>

                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="draft">Draft</option>

                  <option value="published">Published</option>
                </select>
              </div>

              {postType.features?.parent_page && (
                <div className="form-group">
                  <label>Parent Page</label>

                  <select
                    value={parentId}
                    onChange={(event) => setParentId(event.target.value)}
                  >
                    <option value="">No Parent</option>

                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="content-card">
              <div className="content-card-header">
                <div>
                  <h2>SEO</h2>

                  <p>Search engine optimization settings.</p>
                </div>
              </div>

              <div className="form-group">
                <label>SEO Title</label>

                <input
                  type="text"
                  value={metaTitle}
                  onChange={(event) => setMetaTitle(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>SEO Description</label>

                <textarea
                  value={metaDescription}
                  onChange={(event) => setMetaDescription(event.target.value)}
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>Focus Keyword</label>

                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(event) => setFocusKeyword(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Canonical URL</label>

                <input
                  type="text"
                  value={canonicalUrl}
                  onChange={(event) => setCanonicalUrl(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Robots</label>

                <select
                  value={robots}
                  onChange={(event) => setRobots(event.target.value)}
                >
                  <option value="index,follow">Index, Follow</option>

                  <option value="noindex,follow">Noindex, Follow</option>

                  <option value="index,nofollow">Index, Nofollow</option>

                  <option value="noindex,nofollow">Noindex, Nofollow</option>
                </select>
              </div>

              <div className="form-group">
                <label>Schema Type</label>

                <select
                  value={schemaType}
                  onChange={(event) => setSchemaType(event.target.value)}
                >
                  <option value="Article">Article</option>

                  <option value="WebPage">WebPage</option>

                  <option value="BlogPosting">BlogPosting</option>

                  <option value="Product">Product</option>
                </select>
              </div>
            </div>

            <div className="content-card">
              <div className="content-card-header">
                <div>
                  <h2>Social SEO</h2>
                </div>
              </div>

              <div className="form-group">
                <label>OG Title</label>

                <input
                  type="text"
                  value={ogTitle}
                  onChange={(event) => setOgTitle(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>OG Description</label>

                <textarea
                  value={ogDescription}
                  onChange={(event) => setOgDescription(event.target.value)}
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>OG Image</label>

                <input
                  type="text"
                  value={ogImage}
                  onChange={(event) => setOgImage(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Twitter Title</label>

                <input
                  type="text"
                  value={twitterTitle}
                  onChange={(event) => setTwitterTitle(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Twitter Description</label>

                <textarea
                  value={twitterDescription}
                  onChange={(event) =>
                    setTwitterDescription(event.target.value)
                  }
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>Twitter Image</label>

                <input
                  type="text"
                  value={twitterImage}
                  onChange={(event) => setTwitterImage(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="content-card">
              <div className="content-card-header">
                <div>
                  <h2>Featured Image</h2>
                </div>
              </div>

              <div className="form-group">
                <label>Featured Image</label>

                <div
                  className="content-featured-image-selector"
                  onClick={() => setIsMediaSelectorOpen(true)}
                >
                  {selectedMedia ? (
                    <>
                      <img
                        src={getMediaUrl(selectedMedia.url)}
                        alt={selectedMedia.alt_text || selectedMedia.title}
                        className="content-featured-image-preview"
                      />

                      <p>
                        {selectedMedia.title || selectedMedia.original_name}
                      </p>

                      <small>Click to change image</small>
                    </>
                  ) : (
                    <>
                      <div className="content-image-placeholder">🖼️</div>

                      <p>Select Featured Image</p>

                      <small>
                        Choose from Media Library or upload from computer
                      </small>
                    </>
                  )}
                </div>
              </div>
            </div>

            {postType.features?.categories && (
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Categories</h2>
                  </div>

                  <button
                    type="button"
                    className="content-secondary-button"
                    onClick={() => setShowAddCategory(!showAddCategory)}
                  >
                    Add Category
                  </button>
                </div>

                {showAddCategory && (
                  <div className="taxonomy-create-box">
                    <div className="form-group">
                      <label>Category Name</label>

                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(event) =>
                          setNewCategoryName(event.target.value)
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Slug</label>

                      <input
                        type="text"
                        value={newCategorySlug}
                        onChange={(event) =>
                          setNewCategorySlug(event.target.value)
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Parent Category</label>

                      <select
                        value={newCategoryParentId}
                        onChange={(event) =>
                          setNewCategoryParentId(event.target.value)
                        }
                      >
                        <option value="">No Parent</option>

                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="content-primary-button"
                      onClick={handleAddCategory}
                      disabled={addingCategory}
                    >
                      {addingCategory ? "Adding..." : "Create Category"}
                    </button>
                  </div>
                )}

                <div>
                  {categories.map((category) => (
                    <label key={category.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category.id)}
                        onChange={() => handleCategoryChange(category.id)}
                      />

                      <span>{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {postType.features?.tags && (
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Tags</h2>
                  </div>

                  <button
                    type="button"
                    className="content-secondary-button"
                    onClick={() => setShowAddTag(!showAddTag)}
                  >
                    Add Tag
                  </button>
                </div>

                {showAddTag && (
                  <div className="taxonomy-create-box">
                    <div className="form-group">
                      <label>Tag Name</label>

                      <input
                        type="text"
                        value={newTagName}
                        onChange={(event) => setNewTagName(event.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Slug</label>

                      <input
                        type="text"
                        value={newTagSlug}
                        onChange={(event) => setNewTagSlug(event.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="content-primary-button"
                      onClick={handleAddTag}
                      disabled={addingTag}
                    >
                      {addingTag ? "Adding..." : "Create Tag"}
                    </button>
                  </div>
                )}

                <div>
                  {tags.map((tag) => (
                    <label key={tag.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag.id)}
                        onChange={() => handleTagChange(tag.id)}
                      />

                      <span>{tag.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="content-card">
              <div className="content-actions">
                <button
                  type="submit"
                  className="content-primary-button"
                  disabled={saving}
                >
                  {saving ? "Updating..." : "Update Content"}
                </button>

                <button
                  type="button"
                  className="content-secondary-button"
                  onClick={() => navigate(`/admin/content/${postTypeSlug}`)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <MediaSelector
        isOpen={isMediaSelectorOpen}
        onClose={() => setIsMediaSelectorOpen(false)}
        onSelect={(media) => {
          setSelectedMedia(media);

          setFeaturedImage(media.url);

          setIsMediaSelectorOpen(false);
        }}
        selectedMediaId={selectedMedia?._id}
      />
    </div>
  );
};

export default EditContent;
