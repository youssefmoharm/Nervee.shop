import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="mb-6" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <Link to="/" className="text-navy/50 hover:text-navy transition-colors" aria-label="Home">
            Home
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center space-x-2">
            <ChevronRight size={14} className="text-navy/30" />
            {item.path ? (
              <Link
                to={item.path}
                className={`text-sm font-medium ${
                  index === items.length - 1
                    ? 'text-navy'
                    : 'text-navy/70 hover:text-navy transition-colors'
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`text-sm ${index === items.length - 1 ? 'text-navy' : 'text-navy/70'}`}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
