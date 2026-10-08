import axios from "axios";

import { API_URL } from "./config";

const SETTINGS_URL = `${API_URL}/api/settings`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

export interface ReadingSettings {
  homepage_type: "latest_posts" | "static";

  homepage_id: string;

  posts_page_id: string;

  search_engine_visibility: boolean;
}

export const getReadingSettings = async (): Promise<ReadingSettings> => {
  const response = await axios.get(`${SETTINGS_URL}/reading`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const updateReadingSettings = async (settings: ReadingSettings) => {
  const formData = new FormData();

  formData.append("homepage_type", settings.homepage_type);

  formData.append("homepage_id", settings.homepage_id);

  formData.append("posts_page_id", settings.posts_page_id);

  formData.append(
    "search_engine_visibility",
    String(settings.search_engine_visibility),
  );

  const response = await axios.put(`${SETTINGS_URL}/reading`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};
