import axios from "axios";
import { API_URL } from "./config";

const SITE_IDENTITY_URL = `${API_URL}/api/settings/site-identity`;

export interface SiteIdentity {
  logo_url: string;
  favicon_url: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getPublicSiteIdentity = async (): Promise<SiteIdentity> => {
  const response = await axios.get<SiteIdentity>(
    `${SITE_IDENTITY_URL}/public`,
  );
  return response.data;
};

export const getSiteIdentity = async (): Promise<SiteIdentity> => {
  const response = await axios.get<SiteIdentity>(SITE_IDENTITY_URL, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateSiteIdentity = async (
  identity: SiteIdentity,
): Promise<void> => {
  await axios.put(SITE_IDENTITY_URL, identity, {
    headers: getAuthHeaders(),
  });
};
