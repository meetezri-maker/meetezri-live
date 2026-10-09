import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/pages/Landing", () => ({
  Landing: () => <h1>Public homepage</h1>,
}));
vi.mock("@/app/pages/EarlyAccess", () => ({
  EarlyAccess: () => <h1>Early access campaign</h1>,
}));

import { HOMEPAGE_ROUTE_ELEMENTS } from "./homepageRoutes";

interface DeploymentRule {
  source: string;
  destination: string;
  permanent?: boolean;
}

const deploymentConfig = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "vercel.json"), "utf8"),
) as { redirects: DeploymentRule[]; rewrites: DeploymentRule[] };

function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <output>{`${location.pathname}|${navigationType}`}</output>;
}

function renderPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Suspense fallback={<p>Loading</p>}>
        <Routes>
          {HOMEPAGE_ROUTE_ELEMENTS.map(({ path: routePath, element }) => (
            <Route key={routePath} path={routePath} element={element} />
          ))}
        </Routes>
      </Suspense>
    </MemoryRouter>,
  );
}

describe("homepage routes", () => {
  it("renders the public Landing page at /", async () => {
    renderPath("/");

    expect(await screen.findByRole("heading", { name: "Public homepage" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Early access campaign" })).not.toBeInTheDocument();
  });

  it("replaces /home with / and renders Landing as the SPA fallback", async () => {
    renderPath("/home");

    expect(await screen.findByRole("heading", { name: "Public homepage" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("/|REPLACE")).toBeInTheDocument());
  });

  it("keeps the paid campaign at /early-access", async () => {
    renderPath("/early-access");

    expect(await screen.findByRole("heading", { name: "Early access campaign" })).toBeInTheDocument();
    expect(screen.getByText("/early-access|POP")).toBeInTheDocument();
  });
});

describe("deployment homepage redirect", () => {
  it("declares /home as a permanent redirect to / before rewrites", () => {
    expect(deploymentConfig.redirects).toEqual([
      { source: "/home", destination: "/", permanent: true },
    ]);
    expect(Object.keys(deploymentConfig).indexOf("redirects")).toBeLessThan(
      Object.keys(deploymentConfig).indexOf("rewrites"),
    );
  });

  it("keeps renderer and API rewrites ahead of the final SPA fallback", () => {
    const sources = deploymentConfig.rewrites.map((rule) => rule.source);
    expect(sources.slice(0, 5)).toEqual([
      "/api/:path*",
      "/resources",
      "/resources/:slug",
      "/sitemap.xml",
      "/robots.txt",
    ]);
    expect(deploymentConfig.rewrites.find((rule) => rule.source === "/")).toEqual({
      source: "/",
      destination: "/_public/home.html",
    });
    expect(deploymentConfig.rewrites[deploymentConfig.rewrites.length - 1]).toEqual({
      source: "/(.*)",
      destination: "/spa.html",
    });
  });
});
