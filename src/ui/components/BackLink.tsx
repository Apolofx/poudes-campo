import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface BackLinkProps {
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

export function BackLink({ to, onClick, children }: BackLinkProps) {
  const content = (
    <>
      <ChevronLeft size={18} aria-hidden="true" />
      <span>{children}</span>
    </>
  );
  if (to) return <Link className="back-link" to={to}>{content}</Link>;
  return (
    <button type="button" className="back-link" onClick={onClick}>
      {content}
    </button>
  );
}
