import { NavLink } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Navegación principal">
      <NavLink to="/" end className="tab">
        <Home className="tab-icon" size={20} aria-hidden="true" />
        <span>Inicio</span>
      </NavLink>
      <NavLink to="/buscar" className="tab">
        <Search className="tab-icon" size={20} aria-hidden="true" />
        <span>Buscar</span>
      </NavLink>
    </nav>
  );
}
