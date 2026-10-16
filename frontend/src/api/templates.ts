import axios from "axios";
import { API_URL } from "./config";
import type { PageWidget, BuilderGlobals } from "../types/pageBuilder";

const TEMPLATES_URL = `${API_URL}/api/header-footer`;
const PUBLIC_URL = `${API_URL}/api/public`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}` };
};

export type TemplateType =
  | "header"
  | "footer"
  | "single_product"
  | "single_post"
  | "single_page"
  | "archive"
  | "search_results"
  | "loop_item"
  | "error_404"
  | "shop"
  | "cart"
  | "checkout"
  | "my_account"
  | "order_received";

export interface TemplateConditions {
  include?: string[];
  exclude?: string[];
  specific_pages?: string[];
  specific_posts?: string[];
  specific_products?: string[];
  specific_items?: string[];
  post_types?: string[];
  singles?: string[];
  archives?: string[];
  taxonomies?: string[];
  priority?: number;
}

export interface HeaderFooterTemplate {
  id: string;
  title: string;
  slug: string;
  layout: PageWidget[];
  globals?: BuilderGlobals;
  template_type: TemplateType;
  conditions?: TemplateConditions;
  is_default?: boolean;
  status: "draft" | "published";
  created_at?: string;
  updated_at?: string;
}

export interface TemplateSources {
  pages: { id: string; label: string; slug: string }[];
  posts: { id: string; label: string; slug: string }[];
  products: { id: string; label: string; slug: string }[];
  custom_post_types: { id: string; label: string; slug: string }[];
  custom_items: Record<string, { id: string; label: string; slug: string }[]>;
  categories: { id: string; label: string; slug: string }[];
  tags: { id: string; label: string; slug: string }[];
}

// ============ ADMIN ============

export const listTemplates = async (type: TemplateType): Promise<HeaderFooterTemplate[]> => {
  const res = await axios.get(`${TEMPLATES_URL}/list/${type}`, { headers: getHeaders() });
  return res.data.templates;
};

export const getTemplate = async (id: string): Promise<HeaderFooterTemplate> => {
  const res = await axios.get(`${TEMPLATES_URL}/${id}`, { headers: getHeaders() });
  return res.data;
};

export const createTemplate = async (data: {
  title: string;
  slug: string;
  layout: PageWidget[];
  status: "draft" | "published";
  globals?: BuilderGlobals;
  template_type: TemplateType;
  conditions?: TemplateConditions;
  is_default?: boolean;
}) => {
  const res = await axios.post(TEMPLATES_URL, data, { headers: getHeaders() });
  return res.data;
};

export const updateTemplate = async (
  id: string,
  data: {
    title: string;
    slug: string;
    layout: PageWidget[];
    status: "draft" | "published";
    globals?: BuilderGlobals;
    template_type: TemplateType;
    conditions?: TemplateConditions;
    is_default?: boolean;
  }
) => {
  const res = await axios.put(`${TEMPLATES_URL}/${id}`, data, { headers: getHeaders() });
  return res.data;
};

export const deleteTemplate = async (id: string) => {
  const res = await axios.delete(`${TEMPLATES_URL}/${id}`, { headers: getHeaders() });
  return res.data;
};

export const duplicateTemplate = async (id: string) => {
  const res = await axios.post(`${TEMPLATES_URL}/${id}/duplicate`, {}, { headers: getHeaders() });
  return res.data;
};

export const getAllSources = async (): Promise<TemplateSources> => {
  const res = await axios.get(`${TEMPLATES_URL}/sources/all`, { headers: getHeaders() });
  return res.data;
};

// ============ PUBLIC ============

export const fetchActiveHeader = async (
  urlPath: string,
  postType?: string,
  slug?: string
): Promise<HeaderFooterTemplate | null> => {
  try {
    const res = await axios.get(`${PUBLIC_URL}/header`, {
      params: { url_path: urlPath, post_type: postType, slug: slug },
    });
    return res.data.template || null;
  } catch {
    return null;
  }
};

export const fetchActiveFooter = async (
  urlPath: string,
  postType?: string,
  slug?: string
): Promise<HeaderFooterTemplate | null> => {
  try {
    const res = await axios.get(`${PUBLIC_URL}/footer`, {
      params: { url_path: urlPath, post_type: postType, slug: slug },
    });
    return res.data.template || null;
  } catch {
    return null;
  }
};

export const fetchActiveTemplate = async (
  type: TemplateType,
  urlPath: string,
  postType?: string,
  slug?: string,
): Promise<HeaderFooterTemplate | null> => {
  const res = await axios.get(`${TEMPLATES_URL}/active/${type}`, {
    params: { url_path: urlPath, post_type: postType, slug },
  });
  return res.data.template || null;
};