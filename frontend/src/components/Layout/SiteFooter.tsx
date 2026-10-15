import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import BuilderRenderer from "../ContentRenderer/BuilderRenderer";
import { fetchActiveFooter, type HeaderFooterTemplate } from "../../api/templates";
import type { ResponsiveDevice } from "../../types/pageBuilder";

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

const SiteFooter = () => {
  const location = useLocation();
  const [footer, setFooter] = useState<HeaderFooterTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const device = useDevice();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const path = location.pathname;
      const parts = path.split("/").filter(Boolean);
      const slug = parts[parts.length - 1] || "";
      const postType = parts[0] || "";

      const result = await fetchActiveFooter(path, postType, slug);
      setFooter(result);
      setLoading(false);
    };
    void load();
  }, [location.pathname]);

  if (loading) return null;
  if (!footer?.layout?.length) return null;

  return (
    <footer className="site-footer" data-template-id={footer.id}>
      <BuilderRenderer layout={footer.layout} device={device} />
    </footer>
  );
};

export default SiteFooter;