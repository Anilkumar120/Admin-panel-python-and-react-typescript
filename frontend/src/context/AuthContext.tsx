import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import axios from "axios";

import { API_URL } from "../api/config";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  profile_image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, userData?: User, refreshToken?: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let refreshPromise: Promise<string | null> | null = null;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
      return null;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const formData = new FormData();

        formData.append("refresh_token", refreshToken);

        const response = await axios.post(
          `${API_URL}/api/auth/refresh`,
          formData,
        );

        const newAccessToken = response.data.access_token;

        localStorage.setItem("access_token", newAccessToken);

        return newAccessToken;
      } catch (error) {
        localStorage.removeItem("access_token");

        localStorage.removeItem("refresh_token");

        setUser(null);

        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  const loadUser = async () => {
    let token = localStorage.getItem("access_token");

    if (!token) {
      setLoading(false);

      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/profile/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        token = await refreshAccessToken();

        if (token) {
          try {
            const response = await axios.get(`${API_URL}/api/profile/`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            setUser(response.data);

            setLoading(false);

            return;
          } catch (refreshError) {
            console.log("REFRESH USER ERROR:", refreshError);
          }
        }
      }

      console.log("AUTH USER ERROR:", error);

      localStorage.removeItem("access_token");

      localStorage.removeItem("refresh_token");

      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,

      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          !originalRequest?._retry &&
          !originalRequest?.url?.includes("/api/auth/login") &&
          !originalRequest?.url?.includes("/api/auth/refresh")
        ) {
          originalRequest._retry = true;

          const token = await refreshAccessToken();

          if (token) {
            originalRequest.headers = originalRequest.headers || {};

            originalRequest.headers.Authorization = `Bearer ${token}`;

            return axios(originalRequest);
          }
        }

        return Promise.reject(error);
      },
    );

    loadUser();

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = (token: string, userData?: User, refreshToken?: string) => {
    localStorage.setItem("access_token", token);

    if (refreshToken) {
      localStorage.setItem("refresh_token", refreshToken);
    }

    if (userData) {
      setUser(userData);
    } else {
      loadUser();
    }
  };

  const logout = async () => {
    const token = localStorage.getItem("access_token");

    try {
      if (token) {
        await axios.post(
          `${API_URL}/api/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }
    } catch (error) {
      console.log("LOGOUT ERROR:", error);
    } finally {
      localStorage.removeItem("access_token");

      localStorage.removeItem("refresh_token");

      setUser(null);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser((previous) =>
      previous
        ? {
            ...previous,
            ...userData,
          }
        : previous,
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
