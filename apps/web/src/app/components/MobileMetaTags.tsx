import { useEffect } from "react";

export function MobileMetaTags() {
  useEffect(() => {
    // Create meta tags for PWA and mobile optimization
    const metaTags = [
      // PWA - Make it installable
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Ezri" },
      
      // Theme color
      { name: "theme-color", content: "#6366f1" },
      { name: "msapplication-TileColor", content: "#6366f1" },
      
      // Prevent text size adjustment
      { name: "format-detection", content: "telephone=no" },
      
      // Splash screen color
      { name: "apple-mobile-web-app-status-bar-style", content: "default" }
    ];

    // Add meta tags
    metaTags.forEach(({ name, content }) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    });

    // Add manifest link
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.setAttribute("rel", "manifest");
      manifestLink.setAttribute("href", "/manifest.json");
      document.head.appendChild(manifestLink);
    }

    // Add touch icons for iOS
    const touchIconSizes = [180, 167, 152, 120];
    touchIconSizes.forEach((size) => {
      let link = document.querySelector(`link[rel="apple-touch-icon"][sizes="${size}x${size}"]`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "apple-touch-icon");
        link.setAttribute("sizes", `${size}x${size}`);
        link.setAttribute("href", `/icon-${size}.png`);
        document.head.appendChild(link);
      }
    });

    // Prevent pull-to-refresh on iOS Safari
    document.body.style.overscrollBehavior = "none";
    
    // Add safe-area-inset CSS variables support
    const style = document.createElement("style");
    style.textContent = `
      :root {
        --safe-area-inset-top: env(safe-area-inset-top, 0px);
        --safe-area-inset-right: env(safe-area-inset-right, 0px);
        --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
        --safe-area-inset-left: env(safe-area-inset-left, 0px);
      }
      
      /* iOS specific fixes */
      html {
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
      
      input, textarea, button {
        -webkit-user-select: text;
        user-select: text;
      }
      
      /* Better scrolling on iOS */
      * {
        -webkit-overflow-scrolling: touch;
      }
      
      /* Prevent zoom on input focus */
      input, select, textarea {
        font-size: 16px;
      }
      
      /* Touch-optimized elements */
      .touch-target {
        min-width: 44px;
        min-height: 44px;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return null;
}
