import type { ComponentType, ReactNode } from 'react';
import {
  NavigationType,
  Router,
  StaticRouter,
  createPath,
  parsePath,
  type Navigator,
  type To,
} from 'react-router';
import { PublicRouteMetadata } from '@/app/seo/PublicRouteMetadata';

function href(to: To): string {
  return typeof to === 'string' ? to : createPath(to);
}

const documentNavigator: Navigator = {
  createHref: href,
  encodeLocation: (to) => {
    const parsed = parsePath(href(to));
    return {
      pathname: parsed.pathname ?? '/', search: parsed.search ?? '', hash: parsed.hash ?? '',
    };
  },
  go: (delta) => window.history.go(delta),
  push: (to) => window.location.assign(href(to)),
  replace: (to) => window.location.replace(href(to)),
};

function DocumentRouter({ children }: { children: ReactNode }) {
  const location = {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: null,
    key: 'public-document',
  };
  return (
    <Router location={location} navigationType={NavigationType.Pop} navigator={documentNavigator}>
      {children}
    </Router>
  );
}

export interface PublicMarketingAppProps {
  Page: ComponentType;
  pathname: string;
  mode: 'server' | 'client';
}

export function PublicMarketingApp({ Page, pathname, mode }: PublicMarketingAppProps) {
  const content = (
    <>
      <PublicRouteMetadata />
      <Page />
    </>
  );
  return mode === 'server' ? (
    <StaticRouter location={pathname}>{content}</StaticRouter>
  ) : (
    <DocumentRouter>{content}</DocumentRouter>
  );
}
