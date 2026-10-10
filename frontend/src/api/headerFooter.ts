
import axios from "axios";
import { API_URL } from "./config";

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
};

export interface HeaderFooterElement {
  id: string;
  type: string;
  settings: Record<string, any>;
  children?: HeaderFooterElement[];
}

export interface HeaderFooterTemplate {
  id: string;
  name: string;
  template_type: "header" | "footer";
  display: "global" | "pages";
  page_ids: string[];
  priority: number;
  status: boolean;
  elements: HeaderFooterElement[];
}

export interface HeaderFooterData {
  name: string;
  template_type: "header" | "footer";
  display: "global" | "pages";
  page_ids: string[];
  priority: number;
  status: boolean;
  elements: HeaderFooterElement[];
}

export const getHeaderFooterTemplates = async (
  templateType?: string,
) => {
  const response = await axios.get(`${API_URL}/api/header-footer`, {
    params: templateType ? { template_type: templateType } : {},
    headers: getHeaders(),
  });

  return response.data;
};

export const getHeaderFooterTemplate = async (templateId: string) => {
  const response = await axios.get(
    `${API_URL}/api/header-footer/${encodeURIComponent(templateId)}`,
    { headers: getHeaders() },
  );

  return response.data;
};

export const createHeaderFooterTemplate = async (
  data: HeaderFooterData,
) => {
  const response = await axios.post(
    `${API_URL}/api/header-footer`,
    data,
    { headers: getHeaders() },
  );

  return response.data;
};

export const updateHeaderFooterTemplate = async (
  templateId: string,
  data: HeaderFooterData,
) => {
  const response = await axios.put(
    `${API_URL}/api/header-footer/${encodeURIComponent(templateId)}`,
    data,
    { headers: getHeaders() },
  );

  return response.data;
};

export const deleteHeaderFooterTemplate = async (templateId: string) => {
  const response = await axios.delete(
    `${API_URL}/api/header-footer/${encodeURIComponent(templateId)}`,
    { headers: getHeaders() },
  );

  return response.data;
};

export const getHeaderFooterMenus = async () => {
  const response = await axios.get(
    `${API_URL}/api/header-footer/menus`,
    { headers: getHeaders() },
  );

  return response.data;
};

export const resolveHeaderFooter = async (
  templateType: "header" | "footer",
  pageId?: string,
) => {
  const response = await axios.get(
    `${API_URL}/api/header-footer/resolve/${templateType}`,
    {
      params: pageId ? { page_id: pageId } : {},
      headers: getHeaders(),
    },
  );

  return response.data;
};
