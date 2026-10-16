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

export const getPublicMenu = async (menuId: string) => {
  const response = await axios.get(`${API_URL}/api/public/menus/${menuId}`);
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

// ============ 🆕 FOR HEADER/FOOTER BUILDER ============

export interface MenuForDropdown {
  id: string;
  name: string;
  items: any[];
}

/**
 * Get menus as a simple dropdown list (used by Header/Footer builder
 * to populate the "Select Menu" dropdown, like Elementor).
 */
export const getMenusForDropdown = async (): Promise<MenuForDropdown[]> => {
  const menus = await getMenus();

  // Backend may return {menus: [...]} or directly [...]
  const rawList = Array.isArray(menus)
    ? menus
    : Array.isArray((menus as any)?.menus)
      ? (menus as any).menus
      : [];

  return rawList
    .filter((menu: any) => (menu?.id ?? menu?._id) && menu?.name)
    .map((menu: any) => ({
      id: String(menu.id ?? menu._id),
      name: String(menu.name),
      items: Array.isArray(menu.items)
        ? menu.items
        : Array.isArray(menu.menu_items)
          ? menu.menu_items
          : [],
    }));
};