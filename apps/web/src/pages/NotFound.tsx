import { Link } from 'react-router';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="relative mx-auto flex max-w-lg flex-col items-center px-4 py-28 text-center">
        <div className="bg-gradient-to-br from-brand-400 to-brand-800 bg-clip-text text-[8rem] font-extrabold leading-none tracking-tighter text-transparent">
          404
        </div>
        <h1 className="mt-2 text-2xl font-extrabold">This page went out for a repair</h1>
        <p className="mt-2 text-slate-500">The link may be broken, or the page may have moved.</p>
        <div className="mt-8 flex gap-3">
          <Link to="/" className="btn-secondary">
            <Home className="h-4 w-4" /> Home
          </Link>
          <Link to="/search" className="btn-primary">
            <Search className="h-4 w-4" /> Find a technician
          </Link>
        </div>
      </div>
    </div>
  );
}
