import axios from "axios";

import type { User } from "../types/auth";

import { API_URL } from "./config";

const USERS_URL = `${API_URL}/api/users`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

export interface UsersResponse {
  message: string;

  total: number;

  users: User[];
}

export const getUsers = async (): Promise<UsersResponse> => {
  const response = await axios.get<UsersResponse>(`${USERS_URL}/`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const createUser = async (
  name: string,
  email: string,
  password: string,
  role: string,
) => {
  const formData = new FormData();

  formData.append("name", name);

  formData.append("email", email);

  formData.append("password", password);

  formData.append("role", role);

  const response = await axios.post(`${USERS_URL}/`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getUser = async (userId: string) => {
  const response = await getUsers();

  return response.users.find((user) => user.id === userId);
};

export const updateUser = async (
  userId: string,
  name: string,
  email: string,
  password: string,
  role: string,
  isActive: boolean,
) => {
  const formData = new FormData();

  formData.append("name", name);

  formData.append("email", email);

  formData.append("password", password);

  formData.append("role", role);

  formData.append("is_active", String(isActive));

  const response = await axios.put(`${USERS_URL}/${userId}`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const changeUserRole = async (userId: string, role: string) => {
  const formData = new FormData();

  formData.append("role", role);

  const response = await axios.put(`${USERS_URL}/${userId}/role`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const changeUserStatus = async (userId: string, isActive: boolean) => {
  const formData = new FormData();

  formData.append("is_active", String(isActive));

  const response = await axios.put(`${USERS_URL}/${userId}/status`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getTrashUsers = async (): Promise<UsersResponse> => {
  const response = await axios.get<UsersResponse>(`${USERS_URL}/trash`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const moveUserToTrash = async (userId: string) => {
  const response = await axios.put(
    `${USERS_URL}/${userId}/trash`,
    {},
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const restoreUser = async (userId: string) => {
  const response = await axios.put(
    `${USERS_URL}/${userId}/restore`,
    {},
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const deleteUser = async (userId: string) => {
  const response = await axios.delete(`${USERS_URL}/${userId}`, {
    headers: getHeaders(),
  });

  return response.data;
};
