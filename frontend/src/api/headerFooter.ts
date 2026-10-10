import axios from "axios";
import { API_URL } from "./config";

const BASE_URL = `${API_URL}/header-footer`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
};

const unwrapResponse = (response: any): any => {
  let data = response?.data ?? response;

  // Support common API response wrappers.
  if (data && !Array.isArray(data) && typeof data === "object") {
    if ("items" in data) return data.items;
    if ("templates" in data) return data.templates;
    if ("menus" in data) return data.menus;
    if ("data" in data) return data.data;
  }

  return data;
};

const ensureArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value;

  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;

    for (const key of ["items", "templates", "menus", "data"]) {
      if (Array.isArray(data[key])) {
        return data[key] as T[];
      }
    }
  }

  return [];
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

export type HeaderFooterData = Omit<HeaderFooterTemplate, "id">;

export const getHeaderFooterTemplates = async (
  templateType?: "header" | "footer",
): Promise<HeaderFooterTemplate[]> => {
  const response = await axios.get(BASE_URL, {
    params: templateType ? { template_type: templateType } : {},
    headers: getHeaders(),
  });

  return ensureArray<HeaderFooterTemplate>(unwrapResponse(response));
};

export const getHeaderFooterTemplate = async (
  templateId: string,
): Promise<HeaderFooterTemplate> => {
  const response = await axios.get(`${BASE_URL}/${templateId}`, {
    headers: getHeaders(),
  });

  const data = unwrapResponse(response);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Header/Footer template response.");
  }

  return data as HeaderFooterTemplate;
};

export const createHeaderFooterTemplate = async (data: HeaderFooterData) => {
  const response = await axios.post(BASE_URL, data, {
    headers: getHeaders(),
  });

  return unwrapResponse(response);
};

export const updateHeaderFooterTemplate = async (
  templateId: string,
  data: HeaderFooterData,
) => {
  const response = await axios.put(`${BASE_URL}/${templateId}`, data, {
    headers: getHeaders(),
  });

  return unwrapResponse(response);
};

export const deleteHeaderFooterTemplate = async (templateId: string) => {
  const response = await axios.delete(`${BASE_URL}/${templateId}`, {
    headers: getHeaders(),
  });

  return unwrapResponse(response);
};

export const getHeaderFooterMenus = async (): Promise<any[]> => {
  const response = await axios.get(`${BASE_URL}/menus`, {
    headers: getHeaders(),
  });

  return ensureArray<any>(unwrapResponse(response));
};

export const resolveHeaderFooter = async (
  templateType: "header" | "footer",
  pageId?: string,
): Promise<HeaderFooterTemplate | null> => {
  const response = await axios.get(`${BASE_URL}/resolve/${templateType}`, {
    params: pageId ? { page_id: pageId } : {},
    headers: getHeaders(),
  });

  const data = unwrapResponse(response);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return data as HeaderFooterTemplate;
};
