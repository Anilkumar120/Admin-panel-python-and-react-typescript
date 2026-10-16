import axios from "axios";
import { API_URL } from "./config";

const PUBLIC_URL = `${API_URL}/api/public`;

// ============ TYPES ============

export interface PublicPostType {
  id: string;
  name: string;
  slug: string;
  icon: string;
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

export interface PublicContentItem {
  id: string;
  post_type: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: string;
  featured_image?: string;
  parent_id?: string | null;
  categories?: string[];
  tags?: string[];
  fields?: Record<string, any>;
  seo?: any;
  created_at?: string;
  updated_at?: string;
}

export interface PublicBuilderPage {
  id: string;
  title: string;
  slug: string;
  layout: any[];
  globals?: any;
  status: string;
  show_title?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PublicPostsResponse {
  posts: PublicContentItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ============ API CALLS ============

// Post Types
export const getPublicPostTypes = async (): Promise<PublicPostType[]> => {
  const response = await axios.get(`${PUBLIC_URL}/post-types`);
  return response.data.post_types;
};

// Pages
export const getPublicPages = async (): Promise<PublicContentItem[]> => {
  const response = await axios.get(`${PUBLIC_URL}/pages`);
  return response.data.pages;
};

export const getPublicPageBySlug = async (
  slug: string,
): Promise<PublicContentItem> => {
  const response = await axios.get(`${PUBLIC_URL}/pages/${slug}`);
  return response.data;
};

// Posts
export const getPublicPosts = async (
  page = 1,
  limit?: number,
  category?: string,
  tag?: string,
  search?: string,
): Promise<PublicPostsResponse> => {
  const response = await axios.get(`${PUBLIC_URL}/posts`, {
    params: {
      page,
      ...(limit !== undefined ? { limit } : {}),
      category,
      tag,
      search,
    },
  });
  return response.data;
};

export const getPublicPostBySlug = async (
  slug: string,
): Promise<PublicContentItem> => {
  const response = await axios.get(`${PUBLIC_URL}/posts/${slug}`);
  return response.data;
};

// Custom Post Type Items
export const getPublicItems = async (
  postTypeSlug: string,
  page = 1,
  limit = 10,
) => {
  const response = await axios.get(
    `${PUBLIC_URL}/items/${postTypeSlug}`,
    { params: { page, limit } },
  );
  return response.data;
};

export const getPublicItemBySlug = async (
  postTypeSlug: string,
  slug: string,
): Promise<PublicContentItem> => {
  const response = await axios.get(
    `${PUBLIC_URL}/items/${postTypeSlug}/${slug}`,
  );
  return response.data;
};

// Builder Pages
export const getPublicBuilderPages = async () => {
  const response = await axios.get(`${PUBLIC_URL}/builder-pages`);
  return response.data.pages;
};

export const getPublicBuilderPage = async (
  slug: string,
): Promise<PublicBuilderPage> => {
  const response = await axios.get(`${PUBLIC_URL}/builder-pages/${slug}`);
  return response.data;
};

// Taxonomies
export const getPublicCategories = async (postTypeSlug: string) => {
  const response = await axios.get(
    `${PUBLIC_URL}/taxonomies/${postTypeSlug}/categories`,
  );
  return response.data.categories;
};

export const getPublicTags = async (postTypeSlug: string) => {
  const response = await axios.get(
    `${PUBLIC_URL}/taxonomies/${postTypeSlug}/tags`,
  );
  return response.data.tags;
};