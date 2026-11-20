import { Link, useRouteError } from 'react-router';
import { RefreshCw, TriangleAlert } from 'lucide-react';

export default function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-md p-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <TriangleAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 text-slate-500">
          Sorry, this page hit an unexpected error. Reloading usually fixes it.
        </p>
        <div className="mt-7 flex justify-center gap-2">
          <button className="btn-secondary" onClick={() => location.reload()}>
            <RefreshCw className="h-4 w-4" /> Reload
          </button>
          <Link to="/" className="btn-primary" reloadDocument>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
