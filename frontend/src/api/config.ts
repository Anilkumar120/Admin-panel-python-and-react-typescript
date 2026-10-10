
const API_BASE_URL = String(
  import.meta.env.VITE_API_URL || "",
).trim();

export const API_URL = API_BASE_URL.replace(/\/+$/, "");

export const getImageUrl = (imageUrl?: string | null): string => {
  if (!imageUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  const normalizedPath = imageUrl.startsWith("/")
    ? imageUrl
    : `/${imageUrl}`;

  return `${API_URL}${normalizedPath}`;
};
