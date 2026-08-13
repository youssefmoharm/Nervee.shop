import { Link } from 'react-router-dom';
import { useSEO } from '../lib/seo';

export default function NotFound() {
  useSEO({
    title: 'Page Not Found | NERVE',
    description: 'The page you are looking for could not be found.',
  });
  return (
    <div className="bg-navy min-h-screen flex flex-col items-center justify-center text-center px-5">
      <span className="nv-checker w-16 h-16 mb-8" />
      <h1 className="nv-heading text-7xl md:text-9xl">404</h1>
      <p className="nv-eyebrow text-silver mt-4 mb-8">This page isn&apos;t in the closet.</p>
      <Link
        to="/"
        className="bg-white text-navy nv-eyebrow px-8 py-4 hover:bg-mist transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
