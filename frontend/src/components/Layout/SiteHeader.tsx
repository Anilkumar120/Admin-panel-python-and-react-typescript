import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import BuilderRenderer from "../ContentRenderer/BuilderRenderer";
import { fetchActiveHeader, type HeaderFooterTemplate } from "../../api/templates";
import { getMediaUrl } from "../../api/media";
import { getPublicSiteIdentity, type SiteIdentity } from "../../api/siteIdentity";
import type { PageWidget, ResponsiveDevice } from "../../types/pageBuilder";

const useDevice = (): ResponsiveDevice => {
  const [device, setDevice] = useState<ResponsiveDevice>("desktop");
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice("mobile");
      else if (w < 1024) setDevice("tablet");
      else setDevice("desktop");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return device;
};

const SiteHeader = () => {
  const location = useLocation();
  const [header, setHeader] = useState<HeaderFooterTemplate | null>(null);
  const [siteIdentity, setSiteIdentity] = useState<SiteIdentity>({
    logo_url: "",
    favicon_url: "",
  });
  const [loading, setLoading] = useState(true);
  const device = useDevice();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const path = location.pathname;
      const parts = path.split("/").filter(Boolean);
      const slug = parts[parts.length - 1] || "";
      const postType = parts[0] || "";

      const [headerResult, identityResult] = await Promise.allSettled([
        fetchActiveHeader(path, postType, slug),
        getPublicSiteIdentity(),
      ]);

      if (headerResult.status === "fulfilled") {
        setHeader(headerResult.value);
      } else {
        console.error("PUBLIC HEADER LOAD ERROR:", headerResult.reason);
        setHeader(null);
      }

      if (identityResult.status === "fulfilled") {
        setSiteIdentity(identityResult.value);
      } else {
        console.error("SITE IDENTITY LOAD ERROR:", identityResult.reason);
        setSiteIdentity({ logo_url: "", favicon_url: "" });
      }
      setLoading(false);
    };
    void load();
  }, [location.pathname]);

  if (loading) return null;
  const hasTemplateLogo = (widgets: PageWidget[]): boolean =>
    Boolean(
      widgets?.some(
        (widget) =>
          widget.type === "site_logo" ||
          (widget.children && hasTemplateLogo(widget.children)),
      ),
    );
  const showSiteLogo =
    Boolean(siteIdentity.logo_url) &&
    !hasTemplateLogo(header?.layout || []);
  const headerLayout = (widgets: PageWidget[]): PageWidget[] =>
    widgets.map((widget) => ({
      ...widget,
      ...(widget.type === "site_logo" && siteIdentity.logo_url
        ? { url: siteIdentity.logo_url }
        : {}),
      ...(widget.children
        ? { children: headerLayout(widget.children) }
        : {}),
    }));

  if (!header?.layout?.length && !showSiteLogo) return null;

  return (
    <header className="site-header" data-template-id={header?.id}>
      {showSiteLogo && (
        <a
          href="/"
          aria-label="Go to homepage"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <img
            src={getMediaUrl(siteIdentity.logo_url)}
            alt="Site logo"
            style={{ display: "block", maxWidth: 220, maxHeight: 80, objectFit: "contain" }}
          />
        </a>
      )}
      {header?.layout?.length ? (
        <BuilderRenderer
          layout={headerLayout(header.layout)}
          device={device}
        />
      ) : null}
    </header>
  );
};

export default SiteHeader;