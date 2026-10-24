
import axios from "axios";
import { API_URL } from "./config";

// Normalize API base URL.
const normalizeApiUrl = (value: string | undefined): string => {
  const base = (value || "/api").replace(/\/+$/, "");

  if (base === "/api" || base.endsWith("/api")) {
    return base;
  }

  return `${base}/api`;
};

const API_BASE = normalizeApiUrl(API_URL);
const MEDIA_URL = `${API_BASE}/media`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
};

export interface MediaItem {
  _id: string;
  file_name: string;
  original_name: string;
  title: string;
  alt_text: string;
  description: string;
  mime_type?: string;
  file_type: string;
  extension: string;
  file_size: number;
  url: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MediaResponse {
  items: MediaItem[];
  total: number;
  page: number;
  limit: number;
}

interface MediaListParams {
  page?: number;
  limit?: number;
  search?: string;
  fileType?: string;
}

// List media items.
const getMediaList = async (
  endpoint: string,
  {
    page = 1,
    limit = 50,
    search = "",
    fileType = "",
  }: MediaListParams = {},
): Promise<MediaResponse> => {
  const response = await axios.get<MediaResponse>(
    `${MEDIA_URL}${endpoint}`,
    {
      headers: getHeaders(),
      params: {
        page,
        limit,
        search,
        file_type: fileType,
      },
    },
  );

  return response.data;
};

// Get active media.
export const getMedia = (
  page = 1,
  limit = 50,
  search = "",
  fileType = "",
): Promise<MediaResponse> => {
  return getMediaList("/", { page, limit, search, fileType });
};

// Upload media files.
export const uploadMedia = async (files: File[]) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await axios.post(
    `${MEDIA_URL}/upload`,
    formData,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Import an image from a remote URL.
export const importMediaFromUrl = async (url: string) => {
  const response = await axios.post(
    `${MEDIA_URL}/import-url`,
    { url },
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Update media details.
export const updateMedia = async (
  mediaId: string,
  title: string,
  altText: string,
  description: string,
) => {
  const response = await axios.put(
    `${MEDIA_URL}/${encodeURIComponent(mediaId)}`,
    null,
    {
      headers: getHeaders(),
      params: {
        title,
        alt_text: altText,
        description,
      },
    },
  );

  return response.data;
};

// Move media to trash.
export const deleteMedia = async (mediaId: string) => {
  const response = await axios.delete(
    `${MEDIA_URL}/${encodeURIComponent(mediaId)}`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Bulk move to trash.
export const bulkDeleteMedia = async (mediaIds: string[]) => {
  const response = await axios.post(
    `${MEDIA_URL}/bulk-delete`,
    mediaIds,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Get trashed media.
export const getMediaTrash = (
  page = 1,
  limit = 50,
  search = "",
  fileType = "",
): Promise<MediaResponse> => {
  return getMediaList("/trash", {
    page,
    limit,
    search,
    fileType,
  });
};

// Restore one media item.
export const restoreMedia = async (mediaId: string) => {
  const response = await axios.post(
    `${MEDIA_URL}/${encodeURIComponent(mediaId)}/restore`,
    {},
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Restore multiple media items.
export const bulkRestoreMedia = async (mediaIds: string[]) => {
  const response = await axios.post(
    `${MEDIA_URL}/bulk-restore`,
    mediaIds,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Permanently delete one media item.
export const permanentDeleteMedia = async (mediaId: string) => {
  const response = await axios.delete(
    `${MEDIA_URL}/${encodeURIComponent(mediaId)}/permanent`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Permanently delete multiple media items.
export const bulkPermanentDeleteMedia = async (
  mediaIds: string[],
) => {
  const response = await axios.post(
    `${MEDIA_URL}/bulk-permanent-delete`,
    mediaIds,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Empty trash.
export const emptyMediaTrash = async () => {
  const response = await axios.delete(
    `${MEDIA_URL}/empty-trash`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

// Resolve media URLs without duplicating the /api prefix.
export const getMediaUrl = (url?: string | null): string => {
  if (!url) return "";

  const value = url.trim();

  if (!value) return "";

  // Preserve absolute HTTP/HTTPS URLs, protocol-relative URLs and data URLs.
  if (
    /^(https?:)?\/\//i.test(value) ||
    value.startsWith("data:")
  ) {
    return value;
  }

  // Convert relative media paths to an absolute path on the API origin.
  const path = value.startsWith("/") ? value : `/${value}`;

  const apiOrigin = API_BASE.endsWith("/api")
    ? API_BASE.slice(0, -4)
    : API_BASE;

  return `${apiOrigin}${path}`;
};
