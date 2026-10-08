import axios from "axios";

import { API_URL } from "./config";

const MEDIA_URL = `${API_URL}/api/media`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
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

export const getMedia = async (
  page: number = 1,

  limit: number = 50,

  search: string = "",

  fileType: string = "",
): Promise<MediaResponse> => {
  const response = await axios.get<MediaResponse>(
    `${MEDIA_URL}/`,

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

export const uploadMedia = async (files: File[]) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await axios.post(
    `${MEDIA_URL}/upload`,

    formData,

    {
      headers: {
        ...getHeaders(),

        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
};

export const updateMedia = async (
  mediaId: string,

  title: string,

  altText: string,

  description: string,
) => {
  const response = await axios.put(
    `${MEDIA_URL}/${mediaId}`,

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

export const deleteMedia = async (mediaId: string) => {
  const response = await axios.delete(
    `${MEDIA_URL}/${mediaId}`,

    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

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

export const getMediaTrash = async (
  page: number = 1,

  limit: number = 50,

  search: string = "",

  fileType: string = "",
): Promise<MediaResponse> => {
  const response = await axios.get<MediaResponse>(
    `${MEDIA_URL}/trash`,

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

export const restoreMedia = async (mediaId: string) => {
  const response = await axios.post(
    `${MEDIA_URL}/${mediaId}/restore`,

    {},

    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

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

export const permanentDeleteMedia = async (mediaId: string) => {
  const response = await axios.delete(
    `${MEDIA_URL}/${mediaId}/permanent`,

    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const bulkPermanentDeleteMedia = async (mediaIds: string[]) => {
  const response = await axios.post(
    `${MEDIA_URL}/bulk-permanent-delete`,

    mediaIds,

    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const emptyMediaTrash = async () => {
  const response = await axios.delete(
    `${MEDIA_URL}/empty-trash`,

    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const getMediaUrl = (url?: string) => {
  if (!url) {
    return "";
  }

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  return `${API_URL}${url}`;
};

