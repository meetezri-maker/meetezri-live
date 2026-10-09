/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://www.talktosolace2.ai/early-access"}
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { PRELAUNCH_META } from "./prelaunch.content";
import { usePrelaunchMeta } from "./usePrelaunchMeta";

function EarlyAccessMetadataHarness() {
  usePrelaunchMeta();
  return <Link to="/">Leave campaign</Link>;
}

function renderMetadataRoute() {
  return render(
    <MemoryRouter initialEntries={["/early-access"]}>
      <Routes>
        <Route path="/early-access" element={<EarlyAccessMetadataHarness />} />
        <Route path="/" element={<h1>Public homepage</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function content(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute("content") ?? null;
}

describe("Early Access metadata", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title>Solace</title>
      <meta name="description" content="Baseline description">
      <meta name="robots" content="index, follow">
      <link rel="canonical" href="https://www.talktosolace2.ai/">
    `;
  });

  afterEach(() => {
    cleanup();
    document.head.innerHTML = "";
  });

  it("uses the campaign URL and remains noindex, follow", () => {
    renderMetadataRoute();

    expect(document.title).toBe(PRELAUNCH_META.title);
    expect(content('meta[name="description"]')).toBe(PRELAUNCH_META.description);
    expect(content('meta[name="robots"]')).toBe("noindex, follow");
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://www.talktosolace2.ai/early-access",
    );
    expect(content('meta[property="og:url"]')).toBe(
      "https://www.talktosolace2.ai/early-access",
    );
  });

  it("restores prior metadata and removes campaign-only tags after navigation", async () => {
    renderMetadataRoute();

    fireEvent.click(screen.getByRole("link", { name: "Leave campaign" }));
    expect(await screen.findByRole("heading", { name: "Public homepage" })).toBeInTheDocument();

    await waitFor(() => {
      expect(document.title).toBe("Solace");
      expect(content('meta[name="description"]')).toBe("Baseline description");
      expect(content('meta[name="robots"]')).toBe("index, follow");
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://www.talktosolace2.ai/",
      );
    });

    expect(document.head.querySelectorAll('meta[property^="og:"]')).toHaveLength(0);
    expect(document.head.querySelectorAll('meta[name^="twitter:"]')).toHaveLength(0);
  });
});
