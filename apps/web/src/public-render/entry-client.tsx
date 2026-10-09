import { hydrateRoot } from 'react-dom/client';
import { isPublicRoutePath } from '@meetezri/public-content';
import { loadPublicRoute } from '@/app/routing/publicRouteManifest';
import { PublicMarketingApp } from './PublicMarketingApp';
import '@/styles/index.css';

function authRedirect(): string | null {
  const { hash, search } = window.location;
  if (hash.includes('type=invite') && (hash.includes('access_token') || hash.includes('error='))) {
    return `/invite/create-password${search}${hash}`;
  }
  if (
    hash.includes('access_token') ||
    hash.includes('type=recovery') ||
    hash.includes('error=') ||
    search.includes('code=') ||
    search.includes('error=')
  ) {
    return `/auth/callback${search}${hash}`;
  }
  return null;
}

async function boot() {
  const redirect = authRedirect();
  if (redirect) {
    window.location.replace(redirect);
    return;
  }

  const { pathname } = window.location;
  if (!isPublicRoutePath(pathname)) {
    window.location.replace(`/${window.location.search}${window.location.hash}`);
    return;
  }

  const root = document.getElementById('root');
  if (!root) throw new Error('Public hydration root not found');
  const { default: Page } = await loadPublicRoute(pathname);
  hydrateRoot(root, <PublicMarketingApp Page={Page} pathname={pathname} mode="client" />);
}

void boot();
