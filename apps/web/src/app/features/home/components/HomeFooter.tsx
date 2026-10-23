import { motion } from "motion/react";
import {
  SITE_FOOTER_COLUMNS,
  SITE_FOOTER_COPYRIGHT_YEAR,
  SITE_FOOTER_DISCLAIMER,
} from "@meetezri/public-content";
import { CONTACT_HREF } from "@/app/features/prelaunch/prelaunch.content";
import { LOGIN_PATH } from "../homeActions";
import solaceLogoVertical from "../assets/solace-logo-vertical.webp";

const GRAD = "linear-gradient(135deg, #e91e63 8%, #9c27b0 92%)";

const CAPSULE_CLASS =
  "group flex items-center gap-3.5 rounded-full border-[2px] border-white/80 bg-white/70 px-2 py-2 shadow-md backdrop-blur-[6px] transition-all hover:border-[#e91e63]/40 hover:shadow-lg";
const CAPSULE_STYLE = {
  backgroundImage: "linear-gradient(147deg, rgba(233,30,99,0.02) 8%, rgba(156,39,176,0.04) 92%)",
};
const ICON_RING_CLASS =
  "relative flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border-[2px] border-[#e91e63] shadow-[0px_0px_18px_-4px_rgba(168,85,247,0.5)]";

// The footer's link set is the shared public-site footer (Sign Up and Log In are already
// reachable from the pricing cards and the capsule above, so that column is left out).
const FOOTER_LINKS: readonly { href: string; label: string }[] = SITE_FOOTER_COLUMNS.filter(
  (column) => column.heading !== "Get Started",
).flatMap((column): readonly { href: string; label: string }[] => column.links);

function CapsuleLabel({ children }: { children: string }) {
  return (
    <span
      className="flex-1 text-center pr-4 bg-clip-text text-[15px] font-semibold text-transparent"
      style={{ fontFamily: "'Montserrat', sans-serif", backgroundImage: GRAD }}
    >
      {children}
    </span>
  );
}

export default function HomeFooter() {
  return (
    <footer id="contact" className="relative bg-white pt-12 pb-8 px-6 overflow-hidden scroll-mt-20">
      <div className="mx-auto max-w-[1260px] flex flex-col">
        {/* Main Row: Logo on Left, Contact Pills on Right */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-10 pb-12">
          {/* Left Brand Element: Vertical logo image */}
          <div className="flex flex-col items-center gap-3 w-fit">
            <img
              src={solaceLogoVertical}
              alt="Solace"
              width={432}
              height={467}
              loading="lazy"
              decoding="async"
              className="w-[140px] md:w-[160px] h-auto object-contain"
            />
          </div>

          {/* Right Contact Capsule Pills */}
          <div className="flex flex-col gap-4 w-full max-w-[340px]">
            {/* Email Capsule */}
            <motion.a href={CONTACT_HREF} className={CAPSULE_CLASS} style={CAPSULE_STYLE} whileHover={{ y: -2 }}>
              <div className={ICON_RING_CLASS}>
                {/* Chat icon */}
                <svg
                  aria-hidden
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="url(#footer_chat_grad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  <defs>
                    <linearGradient id="footer_chat_grad" x1="3" y1="3" x2="21" y2="21">
                      <stop stopColor="#E91E63" />
                      <stop offset="1" stopColor="#9C27B0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <CapsuleLabel>Email Us</CapsuleLabel>
            </motion.a>

            {/* Log In Capsule — the design's phone capsule had no number to call */}
            <motion.a href={LOGIN_PATH} className={CAPSULE_CLASS} style={CAPSULE_STYLE} whileHover={{ y: -2 }}>
              <div className={ICON_RING_CLASS}>
                {/* Log-in icon */}
                <svg
                  aria-hidden
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="url(#footer_login_grad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                  <defs>
                    <linearGradient id="footer_login_grad" x1="3" y1="3" x2="21" y2="21">
                      <stop stopColor="#E91E63" />
                      <stop offset="1" stopColor="#9C27B0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <CapsuleLabel>Log In</CapsuleLabel>
            </motion.a>
          </div>
        </div>

        {/* Gradient Horizontal Separator Line */}
        <div
          className="w-full h-[2px] rounded-full"
          style={{ background: "linear-gradient(90deg, #E91E63 0%, #9C27B0 100%)" }}
        />

        {/* Site links — plain anchors, since several of these pages are served outside this app */}
        <nav aria-label="Footer" className="pt-6">
          <ul
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-black/70"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="rounded transition-colors hover:text-[#e91e63]">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Copyright Text */}
        <div className="pt-6 pb-2 text-center">
          <p
            className="text-[14px] text-black/80 font-medium tracking-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            &copy; {SITE_FOOTER_COPYRIGHT_YEAR} Solace. All rights reserved.
          </p>
          <p
            className="mx-auto mt-2 max-w-[640px] text-[12px] leading-[1.5] text-black/55"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {SITE_FOOTER_DISCLAIMER}
          </p>
        </div>
      </div>
    </footer>
  );
}
