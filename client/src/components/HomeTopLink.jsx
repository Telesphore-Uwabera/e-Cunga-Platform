import { Link, useLocation } from 'react-router-dom';
import { handleMarketingHomeNavClick } from '../utils/hashNavigation.js';

export default function HomeTopLink({ onClick, ...rest }) {
  const location = useLocation();
  return (
    <Link
      to="/"
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) handleMarketingHomeNavClick(e, location);
      }}
    />
  );
}
