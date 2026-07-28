import { Link } from 'react-router-dom';

export default function ReportBreadcrumb({ items = [] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-gray-500" aria-label="Breadcrumb">
      <Link to="/reports" className="font-medium text-gray-600 hover:text-slate-900">
        Report
      </Link>
      {items.map((item) => (
        <span key={item.label} className="contents">
          <span>/</span>
          {item.to ? (
            <Link to={item.to} className="font-medium text-gray-600 hover:text-slate-900">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-gray-900">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
