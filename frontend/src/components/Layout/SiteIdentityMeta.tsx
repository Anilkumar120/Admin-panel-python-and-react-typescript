import { useEffect } from "react";
import { getMediaUrl } from "../../api/media";
import { getPublicSiteIdentity } from "../../api/siteIdentity";
import { getPublicReadingSettings } from "../../api/settings";

const SiteIdentityMeta = () => {
  useEffect(() => {
    let active = true;

    const updateFavicon = async () => {
      try {
        const identity = await getPublicSiteIdentity();
        if (!active) return;

        let icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
        if (!icon) {
          icon = document.createElement("link");
          icon.rel = "icon";
          document.head.appendChild(icon);
        }

        icon.href = identity.favicon_url
          ? getMediaUrl(identity.favicon_url)
          : "/favicon.svg";
        icon.type = !identity.favicon_url || /\.svg(?:$|\?)/i.test(identity.favicon_url)
          ? "image/svg+xml"
          : "image/png";
      } catch (error) {
        console.error("SITE FAVICON LOAD ERROR:", error);
      }
    };

    const updateRobots = async () => {
      try {
        const readingSettings = await getPublicReadingSettings();
        if (!active) return;
        let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
        if (!robots) {
          robots = document.createElement("meta");
          robots.name = "robots";
          document.head.appendChild(robots);
        }
        robots.content = readingSettings.search_engine_visibility
          ? "noindex,nofollow"
          : "index,follow";
      } catch (error) {
        console.error("SEARCH VISIBILITY SETTINGS LOAD ERROR:", error);
      }
    };

    const handleUpdate = () => {
      void updateFavicon();
      void updateRobots();
    };

    void updateFavicon();
    window.addEventListener("site-identity-updated", handleUpdate);

    return () => {
      active = false;
      window.removeEventListener("site-identity-updated", handleUpdate);
    };
  }, []);

  return null;
};

export default SiteIdentityMeta;
