import axios from "axios";

import { API_URL } from "./config";

const PROFILE_URL = `${API_URL}/api/profile`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

export interface Profile {
  id: string;

  name: string;

  first_name?: string;

  last_name?: string;

  email: string;

  role: string;

  is_active: boolean;

  profile_image: string;

  media_id?: string;
}

export const getImageUrl = (image?: string) => {
  if (!image) {
    return "";
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${API_URL}${image}`;
};

export const getProfile = async (): Promise<Profile> => {
  const response = await axios.get<Profile>(`${PROFILE_URL}/`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const updateProfile = async (
  name: string,
  mediaId?: string,
  email?: string,
  firstName?: string,
  lastName?: string,
) => {
  const formData = new FormData();
  formData.append("name", name);
  if (email !== undefined) formData.append("email", email);
  if (firstName !== undefined) formData.append("first_name", firstName);
  if (lastName !== undefined) formData.append("last_name", lastName);
  if (mediaId) formData.append("media_id", mediaId);
  const response = await axios.put(`${PROFILE_URL}/`, formData, { headers: getHeaders() });
  return response.data;
};

export const uploadProfileImage = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${PROFILE_URL}/image`, formData, { headers: getHeaders() });
  return response.data as { profile_image: string; media_id: string; url: string };
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
) => {
  const formData = new FormData();

  formData.append("current_password", currentPassword);

  formData.append("new_password", newPassword);

  const response = await axios.put(`${PROFILE_URL}/password`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};
