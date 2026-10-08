import axios from "axios";

import { API_URL } from "./config";

const PRODUCTS_URL = `${API_URL}/api/products`;

export const getImageUrl = (image?: string) => {
  if (!image) {
    return "";
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${API_URL}${image}`;
};

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
  brand?: string;
  image?: string;
  media_id?: string;
  is_deleted?: boolean;
}

export interface ProductsResponse {
  message: string;
  total: number;
  products: Product[];
}

export const getProducts = async (
  page: number = 1,
  limit: number = 12,
  search: string = "",
  category: string = "",
): Promise<ProductsResponse> => {
  const response = await axios.get<ProductsResponse>(`${PRODUCTS_URL}/`, {
    headers: getHeaders(),
    params: {
      page,
      limit,
      search,
      category,
    },
  });

  return response.data;
};

export const getProduct = async (productId: string): Promise<Product> => {
  const response = await axios.get<Product>(`${PRODUCTS_URL}/${productId}`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const createProduct = async (
  title: string,
  description: string,
  price: number,
  quantity: number,
  category: string,
  brand: string,
  mediaId: string,
) => {
  const formData = new FormData();

  formData.append("name", title);

  formData.append("description", description);

  formData.append("price", String(price));

  formData.append("quantity", String(quantity));

  formData.append("category", category);

  formData.append("brand", brand);

  formData.append("media_id", mediaId);

  const response = await axios.post(`${PRODUCTS_URL}/`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const updateProduct = async (
  productId: string,
  title: string,
  description: string,
  price: number,
  quantity: number,
  category: string,
  brand: string,
  mediaId?: string,
) => {
  const formData = new FormData();

  formData.append("name", title);

  formData.append("description", description);

  formData.append("price", String(price));

  formData.append("quantity", String(quantity));

  formData.append("category", category);

  formData.append("brand", brand);

  if (mediaId) {
    formData.append("media_id", mediaId);
  }

  const response = await axios.put(`${PRODUCTS_URL}/${productId}`, formData, {
    headers: getHeaders(),
  });

  return response.data;
};

export const deleteProduct = async (productId: string) => {
  const response = await axios.delete(`${PRODUCTS_URL}/${productId}`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const restoreProduct = async (productId: string) => {
  const response = await axios.post(
    `${PRODUCTS_URL}/${productId}/restore`,
    {},
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const permanentDeleteProduct = async (productId: string) => {
  const response = await axios.delete(
    `${PRODUCTS_URL}/${productId}/permanent`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
};

export const getProductCategories = async (): Promise<string[]> => {
  const response = await axios.get<{
    message: string;
    categories: string[];
  }>(`${PRODUCTS_URL}/categories`, {
    headers: getHeaders(),
  });

  return response.data.categories;
};
