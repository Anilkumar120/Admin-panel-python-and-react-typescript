import axios from "axios";

import type { LoginResponse, User } from "../types/auth";

import { API_URL } from "./config";

const AUTH_URL = `${API_URL}/api/auth`;

export const loginUser = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  const formData = new URLSearchParams();

  formData.append("username", email);

  formData.append("password", password);

  const response = await axios.post<LoginResponse>(
    `${AUTH_URL}/login`,
    formData,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  return response.data;
};

export const getCurrentUser = async (token: string): Promise<User> => {
  const response = await axios.get<User>(`${AUTH_URL}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};
