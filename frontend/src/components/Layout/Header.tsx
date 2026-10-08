import { useAuth } from "../../context/AuthContext";

const Header = () => {
  const { user } = useAuth();

  return (
    <header className="admin-header">
      <div className="header-left">
        <h3>Dashboard</h3>
      </div>

      <div className="header-right">
        <div className="header-user">
          <div className="header-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{user?.name}</strong>

            <span>{user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
