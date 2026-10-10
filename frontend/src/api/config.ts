
const API_BASE_URL = import.meta.env.VITE_API_URL || " ";

export const API_URL = API_BASE_URL.replace(/\/+$/, "");

export const getImageUrl = (imageUrl?: string | null): string => {
  if (!imageUrl) {
    return "";
  }

  // Already a complete URL
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  // Keep API and uploaded image paths relative to the current domain
  const normalizedPath = imageUrl.startsWith("/")
    ? imageUrl
    : `/${imageUrl}`;

  return normalizedPath;
};
