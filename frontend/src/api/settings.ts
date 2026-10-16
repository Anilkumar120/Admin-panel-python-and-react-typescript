import axios from "axios";
import { API_URL } from "./config";

const SETTINGS_URL = `${API_URL}/api/settings`;
const PUBLIC_URL = `${API_URL}/api/public`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}` };
};

export interface ReadingSettings {
  homepage_type: "latest_posts" | "static";
  homepage_id: string;
  posts_page_id: string;
  posts_per_page: number;
  feed_items: number;
  feed_content: "full" | "excerpt";
  search_engine_visibility: boolean;
}

export interface PermalinkSettings {
  structure: "plain" | "day_name" | "month_name" | "numeric" | "post_name" | "custom";
  custom_structure: string;
  category_base: string;
  tag_base: string;
  product_base: string;
}

export interface HomepageInfo {
  type: "page" | "builder" | "latest_posts";
  id?: string;
  slug?: string;
  title?: string;
  post_type?: string;
}

export const getReadingSettings = async (): Promise<ReadingSettings> => {
  const response = await axios.get(`${SETTINGS_URL}/reading`, {
    headers: getHeaders(),
  });
  return response.data;
};

export const getPublicReadingSettings = async (): Promise<{
  search_engine_visibility: boolean;
  posts_per_page: number;
  feed_items: number;
  feed_content: "full" | "excerpt";
}> => {
  const response = await axios.get(`${SETTINGS_URL}/reading/public`);
  return response.data;
};

export const updateReadingSettings = async (settings: ReadingSettings) => {
  const formData = new FormData();
  formData.append("homepage_type", settings.homepage_type);
  formData.append("homepage_id", settings.homepage_id);
  formData.append("posts_page_id", settings.posts_page_id);
  formData.append("posts_per_page", String(settings.posts_per_page));
  formData.append("feed_items", String(settings.feed_items));
  formData.append("feed_content", settings.feed_content);
  formData.append(
    "search_engine_visibility",
    String(settings.search_engine_visibility)
  );

  const response = await axios.put(`${SETTINGS_URL}/reading`, formData, {
    headers: getHeaders(),
  });
  return response.data;
};

export const getPermalinkSettings = async (): Promise<PermalinkSettings> => {
  const response = await axios.get(`${SETTINGS_URL}/permalinks`, {
    headers: getHeaders(),
  });
  return response.data;
};

export const getPublicPermalinkSettings = async (): Promise<PermalinkSettings> => {
  const response = await axios.get(`${SETTINGS_URL}/permalinks/public`);
  return response.data;
};

export const updatePermalinkSettings = async (settings: PermalinkSettings) => {
  const response = await axios.put(`${SETTINGS_URL}/permalinks`, settings, {
    headers: getHeaders(),
  });
  return response.data;
};

// 🆕 Get resolved homepage (public, no auth needed)
export const getHomepageInfo = async (): Promise<HomepageInfo> => {
  const response = await axios.get(`${PUBLIC_URL}/homepage`);
  return response.data;
};