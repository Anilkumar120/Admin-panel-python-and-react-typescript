import axios from "axios";

import { API_URL } from "./config";

const DASHBOARD_URL = `${API_URL}/api/dashboard`;

const getHeaders = () => {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface DashboardProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  brand?: string;
  image?: string;
}

export interface DashboardStats {
  message: string;
  total_users: number;
  active_users: number;
  total_products: number;
  trash_products: number;
  recent_users: DashboardUser[];
  recent_products: DashboardProduct[];
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await axios.get<DashboardStats>(`${DASHBOARD_URL}/stats`, {
    headers: getHeaders(),
  });

  return response.data;
};
