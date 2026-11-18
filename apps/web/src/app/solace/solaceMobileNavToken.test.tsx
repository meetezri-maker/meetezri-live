import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";

const tokens = readFileSync(resolve(__dirname, "solace-tokens.css"), "utf8");

describe("--solace-mobile-nav-h token", () => {
  it("includes the bottom safe area in the standard height", () => {
    const base = /\.solace-app \{\s*--solace-sidebar-w[^}]*\}/.exec(tokens)?.[0] ?? "";
    expect(base).toContain(
      "--solace-mobile-nav-h: calc(87.5px + env(safe-area-inset-bottom, 0px));"
    );
  });

  it("includes the bottom safe area in the compact height", () => {
    const compact = /html\[data-ezri-compact-mode\] \.solace-app \{[^}]*\}/.exec(tokens)?.[0] ?? "";
    expect(compact).toContain(
      "--solace-mobile-nav-h: calc(75.5px + env(safe-area-inset-bottom, 0px));"
    );
  });

  it("resets to zero in both modes from the breakpoint where the nav is hidden", () => {
    const desktop = /@media \(min-width: 1024px\) \{\s*\.solace-app,[\s\S]*?\n\}/.exec(tokens)?.[0] ?? "";
    expect(desktop).toContain("html[data-ezri-compact-mode] .solace-app");
    expect(desktop).toContain("--solace-mobile-nav-h: 0px;");
  });
});

/**
 * jsdom has no layout, so the height cannot be measured here. These are the classes
 * the token's px values come from: if this fails, re-measure the nav and update
 * --solace-mobile-nav-h in solace-tokens.css.
 */
describe("MobileBottomNav classes the token depends on", () => {
  const renderNav = (compact: boolean) =>
    render(
      <MemoryRouter>
        <MobileBottomNav compact={compact} />
      </MemoryRouter>
    );

  it("keeps the standard sizing", () => {
    renderNav(false);
    const label = screen.getByText("Home");
    const tab = label.parentElement as HTMLElement;

    expect(label).toHaveClass("text-[11px]");
    expect(tab).toHaveClass("min-h-[52px]", "py-1.5");
    expect(tab.parentElement?.parentElement).toHaveClass("py-2");
  });

  it("keeps the compact sizing", () => {
    renderNav(true);
    const label = screen.getByText("Home");
    const tab = label.parentElement as HTMLElement;

    expect(label).toHaveClass("text-[10px]", "leading-tight");
    expect(tab).toHaveClass("min-h-[52px]", "py-1");
    expect(tab.parentElement?.parentElement).toHaveClass("py-1.5");
  });
});
