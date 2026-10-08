import axios from "axios";

import { API_URL } from "./config";

const MENUS_URL = `${API_URL}/api/menus`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

export const getMenus = async () => {
  const response = await axios.get(MENUS_URL, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getMenu = async (menuId: string) => {
  const response = await axios.get(`${MENUS_URL}/${menuId}`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getMenuSources = async () => {
  const response = await axios.get(`${MENUS_URL}/sources`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const createMenu = async (data: {
  name: string;
  items: any[];
  auto_add_pages?: boolean;
  locations?: string[];
}) => {
  const response = await axios.post(MENUS_URL, data, {
    headers: getHeaders(),
  });

  return response.data;
};

export const updateMenu = async (
  menuId: string,
  data: {
    name: string;
    items: any[];
    auto_add_pages?: boolean;
    locations?: string[];
  },
) => {
  const response = await axios.put(`${MENUS_URL}/${menuId}`, data, {
    headers: getHeaders(),
  });

  return response.data;
};

export const deleteMenu = async (menuId: string) => {
  const response = await axios.delete(`${MENUS_URL}/${menuId}`, {
    headers: getHeaders(),
  });

  return response.data;
};
