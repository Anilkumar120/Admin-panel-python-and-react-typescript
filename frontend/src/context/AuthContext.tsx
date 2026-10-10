import {
  createContext,
  useContext,
  useCallback,
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
  profile_image?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, userData?: User, refreshToken?: string) => void;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let refreshPromise: Promise<string | null> | null = null;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh access token when it expires.
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const storedRefreshToken = localStorage.getItem("refresh_token");

    if (!storedRefreshToken) {
      return null;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const formData = new FormData();

        formData.append("refresh_token", storedRefreshToken);

        const response = await axios.post(
          `${API_URL}/api/auth/refresh`,
          formData,
        );

        const newAccessToken = response.data.access_token;

        if (!newAccessToken) {
          throw new Error("Access token missing from refresh response");
        }

        localStorage.setItem("access_token", newAccessToken);

        return newAccessToken as string;
      } catch (error) {
        console.error("TOKEN REFRESH ERROR:", error);

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }, []);

  // Fetch the latest profile from the backend.
  const refreshUser = useCallback(async (): Promise<void> => {
    let token = localStorage.getItem("access_token");

    if (!token) {
      setUser(null);
      return;
    }

    try {
      let response;

      try {
        response = await axios.get(`${API_URL}/api/profile/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          token = await refreshAccessToken();

          if (!token) {
            throw error;
          }

          response = await axios.get(`${API_URL}/api/profile/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else {
          throw error;
        }
      }

      const latestUser = response.data;

      setUser({
        ...latestUser,
        profile_image:
          typeof latestUser.profile_image === "string"
            ? latestUser.profile_image.trim()
            : (latestUser.profile_image ?? null),
      });
    } catch (error) {
      console.error("LOAD USER ERROR:", error);

      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 403)
      ) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
      }
    }
  }, [refreshAccessToken]);

  // Load the current user when the app starts.
  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      try {
        await refreshUser();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !originalRequest.url?.includes("/api/auth/login") &&
          !originalRequest.url?.includes("/api/auth/refresh")
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

    void initializeAuth();

    return () => {
      active = false;
      axios.interceptors.response.eject(interceptorId);
    };
  }, [refreshAccessToken, refreshUser]);

  // Save login tokens and immediately refresh the profile.
  const login = useCallback(
    (token: string, userData?: User, refreshToken?: string) => {
      localStorage.setItem("access_token", token);

      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }

      // Display login response while the latest profile loads.
      if (userData) {
        setUser({
          ...userData,
          profile_image:
            typeof userData.profile_image === "string"
              ? userData.profile_image.trim()
              : (userData.profile_image ?? null),
        });
      }

      setLoading(true);

      void refreshUser().finally(() => {
        setLoading(false);
      });
    },
    [refreshUser],
  );

  // Logout the current user.
  const logout = useCallback(async (): Promise<void> => {
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
      console.error("LOGOUT ERROR:", error);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      setUser(null);
    }
  }, []);

  // Update user data immediately without reloading the page.
  const updateUser = useCallback((userData: Partial<User>) => {
    setUser((previousUser) => {
      if (!previousUser) {
        return previousUser;
      }

      return {
        ...previousUser,
        ...userData,
        profile_image:
          typeof userData.profile_image === "string"
            ? userData.profile_image.trim()
            : userData.profile_image === null
              ? null
              : userData.profile_image === undefined
                ? previousUser.profile_image
                : userData.profile_image,
      };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
