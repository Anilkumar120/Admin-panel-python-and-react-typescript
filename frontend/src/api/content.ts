import axios from "axios";

import { API_URL } from "./config";

const CONTENT_URL = `${API_URL}/api/content`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

export interface Taxonomy {
  id?: string;

  name: string;

  slug: string;

  type: string;

  parent_id?: string | null;
}

export interface SEOData {
  title: string;

  description: string;

  focus_keyword: string;

  canonical_url: string;

  robots: string;

  og_title: string;

  og_description: string;

  og_image: string;

  twitter_title: string;

  twitter_description: string;

  twitter_image: string;

  schema_type: string;
}

export interface PostType {
  id: string;

  name: string;

  slug: string;

  icon: string;

  is_builtin: boolean;

  is_active: boolean;

  fields?: any[];

  taxonomies?: Taxonomy[];

  features?: {
    title?: boolean;

    description?: boolean;

    featured_image?: boolean;

    seo?: boolean;

    categories?: boolean;

    tags?: boolean;

    parent_page?: boolean;
  };
}

export interface ContentItem {
  id?: string;

  post_type_id?: string;

  post_type_slug?: string;

  post_type?: string;

  title?: string;

  slug?: string;

  content?: string;

  description?: string;

  featured_image?: string;

  featured_image_id?: string;

  status?: string;

  parent_id?: string | null;

  categories?: string[];

  tags?: string[];

  fields?: Record<string, any>;

  seo?: SEOData;

  is_deleted?: boolean;

  deleted_at?: string;

  created_at?: string;

  updated_at?: string;
}

export interface ContentStats {
  posts: number;

  pages: number;

  custom_post_types: number;

  taxonomies: number;
}

export const getContentStats = async (): Promise<ContentStats> => {
  const response = await axios.get(`${CONTENT_URL}/stats`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getPostTypes = async (): Promise<PostType[]> => {
  const response = await axios.get(`${CONTENT_URL}/post-types`, {
    headers: getHeaders(),
  });

  return response.data.post_types;
};

export const createPostType = async (
  name: string,
  slug: string,
  icon: string,
) => {
  const formData = new FormData();

  formData.append("name", name);

  formData.append("slug", slug);

  formData.append("icon", icon);

  const response = await axios.post(`${CONTENT_URL}/post-types`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getPostType = async (postTypeId: string): Promise<PostType> => {
  const response = await axios.get(`${CONTENT_URL}/post-types/${postTypeId}`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getPostTypeBySlug = async (slug: string): Promise<PostType> => {
  const response = await axios.get(
    `${CONTENT_URL}/post-types/by-slug/${slug}`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const updatePostType = async (
  postTypeId: string,
  name: string,
  slug: string,
  icon: string,
) => {
  const formData = new FormData();

  formData.append("name", name);

  formData.append("slug", slug);

  formData.append("icon", icon);

  const response = await axios.put(
    `${CONTENT_URL}/post-types/${postTypeId}`,
    formData,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const deletePostType = async (postTypeId: string) => {
  const response = await axios.delete(
    `${CONTENT_URL}/post-types/${postTypeId}`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const getContentByPostType = async (
  slug: string,
  includeTrash = false,
) => {
  const response = await axios.get(`${CONTENT_URL}/items/${slug}`, {
    params: {
      include_trash: includeTrash,
    },
    headers: getHeaders(),
  });

  return response.data;
};

export const getPages = async (includeTrash = false, publishedOnly = false) => {
  const response = await axios.get(`${CONTENT_URL}/pages`, {
    params: {
      include_trash: includeTrash,
      published_only: publishedOnly,
    },
    headers: getHeaders(),
  });

  return response.data.pages;
};

export const createContent = async (
  postTypeSlug: string,
  data: Record<string, string>,
) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value ?? "");
  });

  const response = await axios.post(
    `${CONTENT_URL}/items/${postTypeSlug}`,
    formData,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const updateContent = async (
  itemId: string,
  data: Record<string, string>,
) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value ?? "");
  });

  const response = await axios.put(`${CONTENT_URL}/items/${itemId}`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getContentItem = async (itemId: string) => {
  const response = await axios.get(`${CONTENT_URL}/items/single/${itemId}`, {
    headers: getHeaders(),
  });

  return response.data;
};

/* =========================
   OLD CONTENT IMAGE UPLOAD
========================= */

export const uploadContentImage = async (file: File) => {
  const formData = new FormData();

  formData.append("file", file);

  const response = await axios.post(`${CONTENT_URL}/upload-image`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const moveContentToTrash = async (itemId: string) => {
  const response = await axios.put(
    `${CONTENT_URL}/items/${itemId}/trash`,
    {},
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const restoreContent = async (itemId: string) => {
  const response = await axios.put(
    `${CONTENT_URL}/items/${itemId}/restore`,
    {},
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const permanentlyDeleteContent = async (itemId: string) => {
  const response = await axios.delete(
    `${CONTENT_URL}/items/${itemId}/permanent`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const bulkMoveToTrash = async (ids: string[]) => {
  const response = await axios.post(`${CONTENT_URL}/items/bulk-trash`, ids, {
    headers: getHeaders(),
  });

  return response.data;
};

export const bulkPermanentDelete = async (ids: string[]) => {
  const response = await axios.post(`${CONTENT_URL}/items/bulk-delete`, ids, {
    headers: getHeaders(),
  });

  return response.data;
};

export const bulkRestoreContent = async (ids: string[]) => {
  const response = await axios.post(`${CONTENT_URL}/items/bulk-restore`, ids, {
    headers: getHeaders(),
  });

  return response.data;
};

export interface Category {
  id: string;

  name: string;

  slug: string;

  parent_id?: string | null;

  post_type_slug: string;
}

export interface Tag {
  id: string;

  name: string;

  slug: string;

  post_type_slug: string;
}

export const getCategories = async (
  postTypeSlug: string,
): Promise<Category[]> => {
  const response = await axios.get(
    `${CONTENT_URL}/taxonomies/${postTypeSlug}/categories`,
    {
      headers: getHeaders(),
    },
  );

  return response.data.categories;
};

export const createCategory = async (
  postTypeSlug: string,
  name: string,
  slug: string,
  parentId = "",
) => {
  const formData = new FormData();

  formData.append("name", name);

  formData.append("slug", slug);

  formData.append("parent_id", parentId);

  const response = await axios.post(
    `${CONTENT_URL}/taxonomies/${postTypeSlug}/categories`,
    formData,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const updateCategory = async (
  categoryId: string,
  name: string,
  slug: string,
  parentId = "",
) => {
  const formData = new FormData();

  formData.append("name", name);

  formData.append("slug", slug);

  formData.append("parent_id", parentId);

  const response = await axios.put(
    `${CONTENT_URL}/taxonomies/categories/${categoryId}`,
    formData,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const deleteCategory = async (categoryId: string) => {
  const response = await axios.delete(
    `${CONTENT_URL}/taxonomies/categories/${categoryId}`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const getTags = async (postTypeSlug: string): Promise<Tag[]> => {
  const response = await axios.get(
    `${CONTENT_URL}/taxonomies/${postTypeSlug}/tags`,
    {
      headers: getHeaders(),
    },
  );

  return response.data.tags;
};

export const createTag = async (
  postTypeSlug: string,
  name: string,
  slug: string,
) => {
  const formData = new FormData();

  formData.append("name", name);

  formData.append("slug", slug);

  const response = await axios.post(
    `${CONTENT_URL}/taxonomies/${postTypeSlug}/tags`,
    formData,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const updateTag = async (tagId: string, name: string, slug: string) => {
  const formData = new FormData();

  formData.append("name", name);

  formData.append("slug", slug);

  const response = await axios.put(
    `${CONTENT_URL}/taxonomies/tags/${tagId}`,
    formData,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const deleteTag = async (tagId: string) => {
  const response = await axios.delete(
    `${CONTENT_URL}/taxonomies/tags/${tagId}`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};
