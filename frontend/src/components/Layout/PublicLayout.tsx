import { Outlet } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

const PublicLayout = () => {
  return (
    <div className="public-layout">
      <SiteHeader />
      <main className="public-main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
};

export default PublicLayout;