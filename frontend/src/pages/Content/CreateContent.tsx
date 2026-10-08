import { useEffect, useState, type FormEvent } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import {
  createCategory,
  createContent,
  createTag,
  getCategories,
  getPages,
  getPostTypeBySlug,
  getTags,
  type Category,
  type ContentItem,
  type PostType,
  type Tag,
} from "../../api/content";

import { getMediaUrl, type MediaItem } from "../../api/media";

import MediaSelector from "../../components/Media/MediaSelector";

const CreateContent = () => {
  const { postTypeSlug } = useParams<{
    postTypeSlug: string;
  }>();

  const navigate = useNavigate();

  const [postType, setPostType] = useState<PostType | null>(null);

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

  const [showAddTag, setShowAddTag] = useState(false);

  const [newTagName, setNewTagName] = useState("");

  const [newTagSlug, setNewTagSlug] = useState("");

  const [addingCategory, setAddingCategory] = useState(false);

  const [addingTag, setAddingTag] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!postTypeSlug) {
        setError("Content Type not found.");

        setLoading(false);

        return;
      }

      try {
        setLoading(true);

        setError("");

        const postTypeResponse = await getPostTypeBySlug(postTypeSlug);

        setPostType(postTypeResponse);

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
              (page: ContentItem) => page.status === "published",
            ),
          );
        }
      } catch (error) {
        console.log("CREATE CONTENT LOAD ERROR:", error);

        setError("Unable to load content type.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [postTypeSlug]);

  const createSlug = (value: string) => {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);

    setSlug(createSlug(value));
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategories((previous) => {
      if (previous.includes(categoryId)) {
        return previous.filter((id) => id !== categoryId);
      }

      return [...previous, categoryId];
    });
  };

  const handleTagChange = (tagId: string) => {
    setSelectedTags((previous) => {
      if (previous.includes(tagId)) {
        return previous.filter((id) => id !== tagId);
      }

      return [...previous, tagId];
    });
  };

  const handleAddCategory = async () => {
    if (!postTypeSlug) {
      return;
    }

    if (!newCategoryName.trim()) {
      setError("Category name is required.");

      return;
    }

    try {
      setAddingCategory(true);

      setError("");

      const categorySlug =
        newCategorySlug.trim() || createSlug(newCategoryName);

      const response = await createCategory(
        postTypeSlug,
        newCategoryName.trim(),
        categorySlug,
        newCategoryParentId,
      );

      const categoryResponse = await getCategories(postTypeSlug);

      setCategories(categoryResponse);

      const newCategoryId = response?.id || response?.category?.id;

      if (newCategoryId) {
        setSelectedCategories((previous) => [...previous, newCategoryId]);
      }

      setNewCategoryName("");

      setNewCategorySlug("");

      setNewCategoryParentId("");

      setShowAddCategory(false);
    } catch (error) {
      console.log("CREATE CATEGORY ERROR:", error);

      setError("Unable to create category.");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleAddTag = async () => {
    if (!postTypeSlug) {
      return;
    }

    if (!newTagName.trim()) {
      setError("Tag name is required.");

      return;
    }

    try {
      setAddingTag(true);

      setError("");

      const tagSlug = newTagSlug.trim() || createSlug(newTagName);

      const response = await createTag(
        postTypeSlug,
        newTagName.trim(),
        tagSlug,
      );

      const tagResponse = await getTags(postTypeSlug);

      setTags(tagResponse);

      const newTagId = response?.id || response?.tag?.id;

      if (newTagId) {
        setSelectedTags((previous) => [...previous, newTagId]);
      }

      setNewTagName("");

      setNewTagSlug("");

      setShowAddTag(false);
    } catch (error) {
      console.log("CREATE TAG ERROR:", error);

      setError("Unable to create tag.");
    } finally {
      setAddingTag(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setError("");

    if (!postType) {
      setError("Content Type not found.");

      return;
    }

    if (!postTypeSlug) {
      setError("Content Type not found.");

      return;
    }

    if (postType.features?.title && !title.trim()) {
      setError("Title is required.");

      return;
    }

    if (postType.features?.title && !slug.trim()) {
      setError("Slug is required.");

      return;
    }

    try {
      setSaving(true);

      const data: Record<string, string> = {};

      data.title = title.trim();

      data.slug = slug.trim();

      data.content = content.trim();

      data.description = content.trim();

      data.status = status;

      data.featured_image = selectedMedia?.url || featuredImage.trim();

      data.featured_image_id = selectedMedia?._id || "";

      data.parent_id = parentId;

      data.categories = selectedCategories.join(",");

      data.tags = selectedTags.join(",");

      data.seo_title = metaTitle.trim();

      data.seo_description = metaDescription.trim();

      data.focus_keyword = focusKeyword.trim();

      data.canonical_url = canonicalUrl.trim();

      data.robots = robots;

      data.og_title = ogTitle.trim();

      data.og_description = ogDescription.trim();

      data.og_image = ogImage.trim();

      data.twitter_title = twitterTitle.trim();

      data.twitter_description = twitterDescription.trim();

      data.twitter_image = twitterImage.trim();

      data.schema_type = schemaType;

      await createContent(postTypeSlug, data);

      navigate(`/admin/content/${postTypeSlug}`);
    } catch (error: any) {
      console.log("CREATE CONTENT ERROR:", error);

      const detail = error?.response?.data?.detail;

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
        setError(detail || "Unable to create content.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="content-page">
        <div className="content-card">Loading...</div>
      </div>
    );
  }

  if (!postType) {
    return (
      <div className="content-page">
        <div className="content-card">
          <div className="content-message-error">
            {error || "Content Type not found."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>
            {postType.icon || "📄"} Add New {postType.name}
          </h1>

          <p>Create a new {postType.name.toLowerCase()}</p>
        </div>

        <div>
          <Link
            to={`/admin/content/${postType.slug}`}
            className="content-secondary-button"
          >
            ← Back
          </Link>
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

                  <p>Create your {postType.name.toLowerCase()}</p>
                </div>
              </div>

              {postType.features?.title && (
                <div className="form-group">
                  <label>Title *</label>

                  <input
                    type="text"
                    value={title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                    placeholder="Enter title"
                    required
                  />
                </div>
              )}

              {postType.features?.title && (
                <div className="form-group">
                  <label>Slug</label>

                  <input
                    type="text"
                    value={slug}
                    onChange={(event) =>
                      setSlug(createSlug(event.target.value))
                    }
                    placeholder="Enter slug"
                  />
                </div>
              )}

              {postType.features?.description && (
                <div className="form-group">
                  <label>Description / Content</label>

                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Enter content"
                    rows={15}
                  />
                </div>
              )}

              {postType.features?.featured_image && (
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
              )}
            </div>

            {postType.features?.seo && (
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>🔎 SEO Settings</h2>

                    <p>Configure SEO for this {postType.name.toLowerCase()}</p>
                  </div>
                </div>

                <div className="form-group">
                  <label>Meta Title</label>

                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(event) => setMetaTitle(event.target.value)}
                    placeholder="Enter meta title"
                  />
                </div>

                <div className="form-group">
                  <label>Meta Description</label>

                  <textarea
                    value={metaDescription}
                    onChange={(event) => setMetaDescription(event.target.value)}
                    placeholder="Enter meta description"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>Focus Keyword</label>

                  <input
                    type="text"
                    value={focusKeyword}
                    onChange={(event) => setFocusKeyword(event.target.value)}
                    placeholder="Enter focus keyword"
                  />
                </div>

                <div className="form-group">
                  <label>Canonical URL</label>

                  <input
                    type="text"
                    value={canonicalUrl}
                    onChange={(event) => setCanonicalUrl(event.target.value)}
                    placeholder="https://example.com/page"
                  />
                </div>

                <div className="form-group">
                  <label>Robots</label>

                  <select
                    value={robots}
                    onChange={(event) => setRobots(event.target.value)}
                  >
                    <option value="index,follow">Index, Follow</option>

                    <option value="noindex,follow">No Index, Follow</option>

                    <option value="index,nofollow">Index, No Follow</option>

                    <option value="noindex,nofollow">
                      No Index, No Follow
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Open Graph Title</label>

                  <input
                    type="text"
                    value={ogTitle}
                    onChange={(event) => setOgTitle(event.target.value)}
                    placeholder="Enter OG title"
                  />
                </div>

                <div className="form-group">
                  <label>Open Graph Description</label>

                  <textarea
                    value={ogDescription}
                    onChange={(event) => setOgDescription(event.target.value)}
                    placeholder="Enter OG description"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>Open Graph Image URL</label>

                  <input
                    type="text"
                    value={ogImage}
                    onChange={(event) => setOgImage(event.target.value)}
                    placeholder="Enter OG image URL"
                  />
                </div>

                <div className="form-group">
                  <label>Twitter Title</label>

                  <input
                    type="text"
                    value={twitterTitle}
                    onChange={(event) => setTwitterTitle(event.target.value)}
                    placeholder="Enter Twitter title"
                  />
                </div>

                <div className="form-group">
                  <label>Twitter Description</label>

                  <textarea
                    value={twitterDescription}
                    onChange={(event) =>
                      setTwitterDescription(event.target.value)
                    }
                    placeholder="Enter Twitter description"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>Twitter Image URL</label>

                  <input
                    type="text"
                    value={twitterImage}
                    onChange={(event) => setTwitterImage(event.target.value)}
                    placeholder="Enter Twitter image URL"
                  />
                </div>

                <div className="form-group">
                  <label>Schema Type</label>

                  <select
                    value={schemaType}
                    onChange={(event) => setSchemaType(event.target.value)}
                  >
                    <option value="Article">Article</option>

                    <option value="WebPage">WebPage</option>

                    <option value="BlogPosting">Blog Posting</option>

                    <option value="NewsArticle">News Article</option>

                    <option value="Product">Product</option>

                    <option value="Service">Service</option>

                    <option value="Event">Event</option>

                    <option value="Organization">Organization</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="content-card">
              <div className="content-card-header">
                <h2>Publish</h2>
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
            </div>

            {postType.features?.parent_page && (
              <div className="content-card">
                <div className="content-card-header">
                  <h2>Parent Page</h2>
                </div>

                <div className="form-group">
                  <label>Parent</label>

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
              </div>
            )}

            {postType.features?.categories && (
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>🗂️ Categories</h2>
                  </div>

                  <button
                    type="button"
                    className="content-secondary-button"
                    onClick={() => setShowAddCategory(!showAddCategory)}
                  >
                    + Add
                  </button>
                </div>

                {showAddCategory && (
                  <div
                    className="taxonomy-create-box"
                    style={{
                      marginBottom: "15px",
                    }}
                  >
                    <div className="form-group">
                      <label>Category Name</label>

                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(event) => {
                          setNewCategoryName(event.target.value);

                          setNewCategorySlug(createSlug(event.target.value));
                        }}
                        placeholder="Enter category name"
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
                        placeholder="category-slug"
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
                      {addingCategory ? "Adding..." : "Add Category"}
                    </button>
                  </div>
                )}

                {categories.length === 0 ? (
                  <p>No categories found.</p>
                ) : (
                  categories.map((category) => (
                    <label key={category.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category.id)}
                        onChange={() => handleCategoryChange(category.id)}
                      />{" "}
                      {category.name}
                    </label>
                  ))
                )}
              </div>
            )}

            {postType.features?.tags && (
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>🏷️ Tags</h2>
                  </div>

                  <button
                    type="button"
                    className="content-secondary-button"
                    onClick={() => setShowAddTag(!showAddTag)}
                  >
                    + Add
                  </button>
                </div>

                {showAddTag && (
                  <div
                    className="taxonomy-create-box"
                    style={{
                      marginBottom: "15px",
                    }}
                  >
                    <div className="form-group">
                      <label>Tag Name</label>

                      <input
                        type="text"
                        value={newTagName}
                        onChange={(event) => {
                          setNewTagName(event.target.value);

                          setNewTagSlug(createSlug(event.target.value));
                        }}
                        placeholder="Enter tag name"
                      />
                    </div>

                    <div className="form-group">
                      <label>Slug</label>

                      <input
                        type="text"
                        value={newTagSlug}
                        onChange={(event) => setNewTagSlug(event.target.value)}
                        placeholder="tag-slug"
                      />
                    </div>

                    <button
                      type="button"
                      className="content-primary-button"
                      onClick={handleAddTag}
                      disabled={addingTag}
                    >
                      {addingTag ? "Adding..." : "Add Tag"}
                    </button>
                  </div>
                )}

                {tags.length === 0 ? (
                  <p>No tags found.</p>
                ) : (
                  tags.map((tag) => (
                    <label key={tag.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag.id)}
                        onChange={() => handleTagChange(tag.id)}
                      />{" "}
                      {tag.name}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="content-actions">
          <button
            type="submit"
            className="content-primary-button"
            disabled={saving}
          >
            {saving ? "Creating..." : `Create ${postType.name}`}
          </button>

          <Link
            to={`/admin/content/${postType.slug}`}
            className="content-secondary-button"
          >
            Cancel
          </Link>
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

export default CreateContent;
