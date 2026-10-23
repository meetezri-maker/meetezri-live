import { Link } from "react-router";
import { motion } from "motion/react";

/** A router `Link` that accepts the design's `motion.a` hover animations. */
const MotionLink = motion.create(Link);

export default MotionLink;
