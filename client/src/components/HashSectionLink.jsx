import { Link, useLocation } from 'react-router-dom';
import { scrollToAnchorById } from '../utils/hashNavigation.js';

export default function HashSectionLink({ to, onClick, ...rest }) {
  const location = useLocation();

  function handleClick(e) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (typeof to !== 'string') return;
    const hashIdx = to.indexOf('#');
    if (hashIdx === -1) return;
    const pathPart = to.slice(0, hashIdx) || '/';
    const id = to.slice(hashIdx + 1).trim();
    if (!id) return;
    const normPath = pathPart === '' ? '/' : pathPart;
    if (location.pathname === normPath && location.hash === `#${id}`) {
      e.preventDefault();
      scrollToAnchorById(id);
    }
  }

  return <Link to={to} {...rest} onClick={handleClick} />;
}
