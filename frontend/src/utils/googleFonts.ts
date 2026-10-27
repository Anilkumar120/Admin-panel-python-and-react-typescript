const SYSTEM_FONT_FAMILIES = new Set([
  "arial",
  "georgia",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "times new roman",
  "courier new",
  "serif",
  "sans-serif",
  "monospace",
  "system-ui",
  "inherit",
]);

export const loadGoogleFont = (fontFamily?: string | null) => {
  const family = String(fontFamily || "")
    .split(",")[0]
    .replace(/["']/g, "")
    .trim();

  if (!family || SYSTEM_FONT_FAMILIES.has(family.toLowerCase())) return;

  const id = `google-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
  document.head.appendChild(link);
};
