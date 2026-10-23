import { useRef, type CSSProperties } from "react";
import { motion, useScroll, useTransform, useSpring, type MotionValue } from "motion/react";
import { useHomeReducedMotion } from "../useHomeReducedMotion";
import { usePinned } from "../layoutModes";
import SolaceEmblem from "./SolaceEmblem";

const GRAD = "linear-gradient(135deg, #e91e63 8%, #9c27b0 92%)";

type MessageGroup = {
  id: number;
  userText: string;
  solaceText: string;
  /**
   * Where the pair sits in the pinned desktop layout. Each message and its reply are one
   * positioned unit, so a reply can never cover its own message; the four pairs keep the
   * design's four-corner composition around the heading.
   */
  pairPos: { top?: string; left?: string; right?: string; bottom?: string };
  // Scroll ranges
  userRange: [number, number];
  solaceRange: [number, number];
};

const MESSAGE_GROUPS: MessageGroup[] = [
  {
    id: 1,
    userText: "I'm feeling so down lately...",
    solaceText:
      "I'm right here with you. It's okay to feel down. Let's take it one gentle step at a time.",
    pairPos: { top: "13%", left: "6%" },
    userRange: [0.08, 0.18],
    solaceRange: [0.18, 0.28],
  },
  {
    id: 2,
    userText: "Everything feels so overwhelming today.",
    solaceText:
      "Take a deep breath. You don't have to figure it all out right now. I'm here to listen.",
    pairPos: { top: "13%", right: "6%" },
    userRange: [0.3, 0.4],
    solaceRange: [0.4, 0.5],
  },
  {
    id: 3,
    userText: "I just need someone to listen, without judging.",
    solaceText:
      "I am always here for you. Share whatever is on your mind—no pressure, no judgment.",
    pairPos: { bottom: "5%", left: "6%" },
    userRange: [0.52, 0.62],
    solaceRange: [0.62, 0.72],
  },
  {
    id: 4,
    userText: "I feel like I'm falling behind everyone else.",
    solaceText:
      "Your journey is uniquely yours. Be gentle with yourself. You are doing the best you can.",
    pairPos: { bottom: "5%", right: "6%" },
    userRange: [0.74, 0.84],
    solaceRange: [0.84, 0.94],
  },
];

function MessageBubble({
  text,
  sender,
  range,
  smoothProgress,
  pinned,
  reduce,
}: {
  text: string;
  sender: "user" | "solace";
  range: [number, number];
  smoothProgress: MotionValue<number>;
  /** Pinned: revealed by the section's scroll. Flow: fades in once on entering the viewport. */
  pinned: boolean;
  reduce: boolean;
}) {
  // Map progress to opacity and scale
  const opacity = useTransform(
    smoothProgress,
    [range[0], range[0] + 0.05, 0.98, 1],
    [0, 1, 1, 0],
  );
  const scale = useTransform(
    smoothProgress,
    [range[0], range[0] + 0.05, 0.98, 1],
    [0.8, 1, 1, 0.8],
  );
  const y = useTransform(smoothProgress, [range[0], range[0] + 0.05], [15, 0]);

  const isUser = sender === "user";

  const flowReveal = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 15 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-10% 0px" },
        transition: { duration: 0.45 },
      };

  return (
    <motion.div
      className={`flex items-center gap-3.5 max-w-[min(340px,80vw)] px-4 py-3 sm:px-5 sm:py-4 rounded-[22px] shadow-lg border will-change-transform ${
        isUser
          ? "self-start text-white border-transparent"
          : "self-start ml-6 bg-white/95 border-[#e91e63]/20 text-slate-800 shadow-[0_10px_25px_-5px_rgba(233,30,99,0.1)]"
      }`}
      style={{
        ...(pinned ? { opacity, scale, y: reduce ? 0 : y } : {}),
        background: isUser ? GRAD : undefined,
      }}
      {...(pinned ? {} : flowReveal)}
    >
      {/* Avatar */}
      <div
        aria-hidden
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-bold text-[13px] border ${
          isUser
            ? "bg-white/20 border-white/30 text-white"
            : "bg-gradient-to-br from-[#e91e63] to-[#9c27b0] border-transparent text-white"
        }`}
      >
        {isUser ? "A" : "S"}
      </div>

      {/* Message content */}
      <div className="flex flex-col text-left">
        <span
          className={`text-[11px] font-bold tracking-wider uppercase mb-0.5 ${
            isUser ? "text-white/70" : "text-[#e91e63]"
          }`}
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {isUser ? "Alex" : "Solace"}
        </span>
        <p
          className="text-[13.5px] font-medium leading-[1.4]"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {text}
        </p>
      </div>
    </motion.div>
  );
}

export default function ConversationSection() {
  const containerRef = useRef<HTMLElement>(null);
  const pinned = usePinned("conversation");
  const reduce = useHomeReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 85,
    damping: 22,
  });

  return (
    <section ref={containerRef} className="home-pin home-pin--conversation relative bg-white">
      <div className="home-pin-stage flex w-full flex-col items-center justify-center px-6">
        {/* Floating background blobs for visual depth */}
        <div className="absolute left-[10%] top-[20%] w-[320px] h-[320px] rounded-full blur-3xl bg-pink-300/10 -z-10" />
        <div className="absolute right-[10%] bottom-[20%] w-[320px] h-[320px] rounded-full blur-3xl bg-purple-300/10 -z-10" />

        {/* Floating Solace Emblem Accent */}
        <div className="absolute right-[4%] top-[14%] pointer-events-none z-0 hidden lg:block opacity-60">
          <SolaceEmblem size={130} tilt={14} />
        </div>

        {/* Central Display Column */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-[640px] pointer-events-none">
          {/* Eyebrow Badge */}
          <span
            className="rounded-[12px] border border-[#e91e63] px-4 py-[6px] text-[11px] font-semibold uppercase"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              backgroundImage:
                "linear-gradient(131deg, rgba(233,30,99,0.12), rgba(156,39,176,0.12))",
            }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: GRAD }}
            >
              Moments
            </span>
          </span>

          {/* Heading */}
          <h2
            className="mt-6 text-[clamp(36px,4.5vw,56px)] leading-[1.08] tracking-[-1.5px] text-black"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
          >
            We understand
            <br />
            how you{" "}
            <span
              className="bg-clip-text font-semibold italic text-transparent relative"
              style={{ backgroundImage: GRAD }}
            >
              Feel
              <span className="absolute bottom-1 left-0 right-0 h-[4px] bg-gradient-to-r from-[#e91e63] to-[#9c27b0] rounded-full" />
            </span>
          </h2>
        </div>

        {/* The conversation, in reading order: each message followed by its reply. Pinned
            on desktop the pairs sit in the corners; otherwise they stack under the heading. */}
        <ol className="home-chat-list relative z-20 mt-10 flex w-full max-w-[420px] flex-col gap-8">
          {MESSAGE_GROUPS.map((group) => (
            <li
              key={group.id}
              className="home-chat-pair flex flex-col gap-2"
              style={
                {
                  "--pair-top": group.pairPos.top ?? "auto",
                  "--pair-left": group.pairPos.left ?? "auto",
                  "--pair-right": group.pairPos.right ?? "auto",
                  "--pair-bottom": group.pairPos.bottom ?? "auto",
                } as CSSProperties
              }
            >
              <MessageBubble
                text={group.userText}
                sender="user"
                range={group.userRange}
                smoothProgress={smoothProgress}
                pinned={pinned}
                reduce={reduce}
              />
              <MessageBubble
                text={group.solaceText}
                sender="solace"
                range={group.solaceRange}
                smoothProgress={smoothProgress}
                pinned={pinned}
                reduce={reduce}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
