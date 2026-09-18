/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Skull } from "lucide-react";
import type { SeedNote, Theme } from "../../types";

const TREE_PALETTES: Record<
  Theme,
  {
    trunk: string;
    branch: string;
    leaf1: string;
    leaf2: string;
    leaf3: string;
    leaf4: string;
    fruit: string;
  }
> = {
  earth: {
    trunk: "from-[#6b4428] via-[#8b5a32] to-[#a96b3b]",
    branch: "bg-[#8b5a32]",
    leaf1: "bg-gradient-to-br from-green-300 to-emerald-700",
    leaf2: "bg-gradient-to-bl from-lime-300 to-green-700",
    leaf3: "bg-gradient-to-br from-lime-200 via-green-400 to-emerald-700",
    leaf4: "bg-gradient-to-br from-green-300 to-emerald-800",
    fruit: "bg-gradient-to-br from-amber-200 to-orange-500",
  },
  forest: {
    trunk: "from-[#3f2a1d] via-[#5a3b25] to-[#775132]",
    branch: "bg-[#5a3b25]",
    leaf1: "bg-gradient-to-br from-emerald-600 to-green-950",
    leaf2: "bg-gradient-to-bl from-lime-500 to-emerald-900",
    leaf3: "bg-gradient-to-br from-green-400 via-emerald-700 to-green-950",
    leaf4: "bg-gradient-to-br from-emerald-500 to-green-950",
    fruit: "bg-gradient-to-br from-yellow-200 to-lime-500",
  },
  bloom: {
    trunk: "from-[#7b4a37] via-[#a26255] to-[#c78a7a]",
    branch: "bg-[#a26255]",
    leaf1: "bg-gradient-to-br from-pink-200 to-rose-500",
    leaf2: "bg-gradient-to-bl from-fuchsia-200 to-pink-500",
    leaf3: "bg-gradient-to-br from-white via-pink-200 to-rose-500",
    leaf4: "bg-gradient-to-br from-rose-200 to-pink-600",
    fruit: "bg-gradient-to-br from-yellow-100 to-rose-400",
  },
  night: {
    trunk: "from-[#26324b] via-[#3d4d70] to-[#6478a6]",
    branch: "bg-[#3d4d70]",
    leaf1: "bg-gradient-to-br from-sky-300 to-blue-800",
    leaf2: "bg-gradient-to-bl from-cyan-200 to-indigo-700",
    leaf3: "bg-gradient-to-br from-white via-sky-300 to-indigo-700",
    leaf4: "bg-gradient-to-br from-blue-300 to-indigo-900",
    fruit: "bg-gradient-to-br from-violet-200 to-fuchsia-500",
  },
  jungle: {
    trunk: "from-[#5b341f] via-[#875027] to-[#b87935]",
    branch: "bg-[#875027]",
    leaf1: "bg-gradient-to-br from-lime-300 to-green-800",
    leaf2: "bg-gradient-to-bl from-yellow-300 to-emerald-700",
    leaf3: "bg-gradient-to-br from-lime-200 via-green-500 to-teal-800",
    leaf4: "bg-gradient-to-br from-green-400 to-teal-900",
    fruit: "bg-gradient-to-br from-orange-200 to-red-500",
  },
  alien: {
    trunk: "from-[#43206f] via-[#6532a8] to-[#9b5cff]",
    branch: "bg-[#6532a8]",
    leaf1: "bg-gradient-to-br from-emerald-200 to-teal-600",
    leaf2: "bg-gradient-to-bl from-cyan-200 to-fuchsia-600",
    leaf3: "bg-gradient-to-br from-lime-200 via-teal-300 to-purple-700",
    leaf4: "bg-gradient-to-br from-fuchsia-300 to-violet-800",
    fruit: "bg-gradient-to-br from-lime-200 to-fuchsia-500",
  },
  desert: {
    trunk: "from-[#7c4b29] via-[#a86734] to-[#d49455]",
    branch: "bg-[#a86734]",
    leaf1: "bg-gradient-to-br from-lime-200 to-lime-700",
    leaf2: "bg-gradient-to-bl from-yellow-200 to-green-700",
    leaf3: "bg-gradient-to-br from-amber-100 via-lime-300 to-green-700",
    leaf4: "bg-gradient-to-br from-lime-200 to-green-800",
    fruit: "bg-gradient-to-br from-yellow-200 to-orange-600",
  },
  arctic: {
    trunk: "from-[#6f8793] via-[#8daab8] to-[#d1edf7]",
    branch: "bg-[#8daab8]",
    leaf1: "bg-gradient-to-br from-cyan-100 to-sky-500",
    leaf2: "bg-gradient-to-bl from-white to-blue-400",
    leaf3: "bg-gradient-to-br from-white via-cyan-100 to-sky-500",
    leaf4: "bg-gradient-to-br from-cyan-200 to-blue-600",
    fruit: "bg-gradient-to-br from-white to-cyan-300",
  },
};

export function PlantIllustration({
  stage,
  progress,
  isGrowth,
  theme = "earth",
}: {
  stage: SeedNote["growthStage"];
  progress: number;
  isGrowth: boolean;
  theme?: Theme;
}) {
  const swayClass = stage !== "withered" ? "sway" : "";
  const stemTransition = {
    type: "spring" as const,
    stiffness: 90,
    damping: 18,
  };
  const tree = TREE_PALETTES[theme] || TREE_PALETTES.earth;

  if (stage === "seed" && !isGrowth) {
    return (
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div className="absolute bottom-3 w-14 h-2 rounded-full bg-[#3e2723]/15 blur-sm" />
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="absolute w-1.5 h-1.5 rounded-full bg-amber-200/70"
            style={{ left: `${22 + dot * 18}px`, top: `${18 + dot * 7}px` }}
            animate={{ y: [0, -5, 0], opacity: [0.25, 0.75, 0.25] }}
            transition={{
              duration: 2.8 + dot * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={stemTransition}
          className="relative w-8 h-10 bg-gradient-to-br from-[#a9784f] via-[#8b5e3c] to-[#5f3d29] rounded-[55%_45%_50%_50%] rotate-[-18deg] shadow-[inset_-8px_-8px_14px_rgba(0,0,0,0.16),0_14px_28px_rgba(95,61,41,0.18)]"
        >
          <div className="absolute left-2 top-2 h-5 w-1 rounded-full bg-white/25 rotate-12" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.35, 1], opacity: [0.24, 0.04, 0.24] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-14 h-14 border border-white/40 rounded-full"
        />
      </div>
    );
  }

  if (stage === "withered") {
    return (
      <div className="relative w-24 h-28 flex flex-col items-center justify-end">
        <div className="absolute bottom-1 w-20 h-3 rounded-full bg-stone-500/20 blur-sm" />
        <motion.div
          initial={{ rotate: 0, opacity: 0.2 }}
          animate={{ rotate: 10, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative w-3 h-20 bg-gradient-to-t from-stone-700 via-stone-500 to-stone-400 rounded-full origin-bottom shadow-sm"
        >
          <div className="absolute left-1/2 top-6 h-9 w-1.5 rounded-full bg-stone-500 origin-bottom rotate-[-45deg]" />
          <div className="absolute right-1/2 top-9 h-8 w-1.5 rounded-full bg-stone-500 origin-bottom rotate-[48deg]" />
        </motion.div>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.75 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="absolute top-4 left-8 h-10 w-12 rounded-full bg-gradient-to-br from-stone-300 to-stone-500 rotate-[-18deg]"
        />
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.55 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="absolute top-8 right-7 h-9 w-10 rounded-full bg-gradient-to-br from-stone-300 to-stone-500 rotate-[20deg]"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.25 }}
          className="absolute bottom-6"
        >
          <Skull size={15} className="text-[var(--text-muted)]" />
        </motion.div>
      </div>
    );
  }

  if (stage === "bloom") {
    return (
      <div
        className={`relative w-28 h-32 flex flex-col items-center justify-end ${swayClass}`}
      >
        <div className="absolute bottom-1 w-24 h-4 rounded-full bg-green-950/10 blur-sm" />
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={stemTransition}
          className={`relative w-4 h-24 bg-gradient-to-t ${tree.trunk} rounded-full origin-bottom shadow-[inset_-5px_0_8px_rgba(0,0,0,0.14)]`}
        >
          <div
            className={`absolute left-1/2 top-8 h-12 w-2 rounded-full ${tree.branch} origin-bottom rotate-[-48deg]`}
          />
          <div
            className={`absolute right-1/2 top-11 h-11 w-2 rounded-full ${tree.branch} origin-bottom rotate-[48deg]`}
          />
          <div
            className={`absolute left-1/2 top-4 h-10 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[-25deg]`}
          />
          <div
            className={`absolute right-1/2 top-5 h-10 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[25deg]`}
          />
        </motion.div>
        {[
          `left-2 top-1 h-16 w-18 ${tree.leaf1}`,
          `right-2 top-2 h-16 w-18 ${tree.leaf2}`,
          `left-1/2 top-[-10px] h-20 w-20 -translate-x-1/2 ${tree.leaf3}`,
          `left-7 top-9 h-14 w-16 ${tree.leaf4}`,
          `right-7 top-10 h-14 w-16 ${tree.leaf2}`,
        ].map((classes, index) => (
          <motion.div
            key={classes}
            initial={{ scale: 0.35, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08 + index * 0.04, ...stemTransition }}
            className={`absolute rounded-full shadow-lg ${classes}`}
          />
        ))}
        {[18, 42, 66].map((left, index) => (
          <motion.span
            key={left}
            className={`absolute h-2.5 w-2.5 rounded-full ${tree.fruit} shadow-sm`}
            style={{ left, top: 34 + (index % 2) * 20 }}
            animate={{ y: [0, -2, 0], opacity: [0.75, 1, 0.75] }}
            transition={{
              duration: 2.4 + index * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  const height = 34 + progress * 0.48;
  const crownScale = 0.65 + progress / 220;
  const crownY = 74 - height;
  const branchOneHeight = Math.max(12, Math.min(24, height * 0.5));
  const branchTwoHeight = Math.max(10, Math.min(22, height * 0.44));
  const branchOneTop = Math.max(8, height - branchOneHeight - 8);
  const branchTwoTop = Math.max(12, height - branchTwoHeight - 5);
  return (
    <div
      className={`relative w-28 h-32 flex flex-col items-center justify-end ${swayClass}`}
    >
      <div className="absolute bottom-1 w-22 h-4 rounded-full bg-green-950/10 blur-sm" />
      <motion.div
        animate={{ height }}
        transition={stemTransition}
        className={`relative w-3 bg-gradient-to-t ${tree.trunk} rounded-full origin-bottom shadow-[inset_-4px_0_6px_rgba(0,0,0,0.12)]`}
      >
        <motion.div
          className={`absolute left-1/2 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[-42deg]`}
          animate={{
            top: branchOneTop,
            height: branchOneHeight,
            opacity: progress > 8 ? 1 : 0.45,
          }}
          transition={stemTransition}
        />
        <motion.div
          className={`absolute right-1/2 w-1.5 rounded-full ${tree.branch} origin-bottom rotate-[42deg]`}
          animate={{
            top: branchTwoTop,
            height: branchTwoHeight,
            opacity: progress > 18 ? 1 : 0.35,
          }}
          transition={stemTransition}
        />
      </motion.div>
      <motion.div
        animate={{ y: crownY, scale: crownScale }}
        transition={stemTransition}
        className="absolute top-0 left-1/2 -translate-x-1/2 h-20 w-24"
      >
        <motion.div
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, ...stemTransition }}
          className={`absolute left-3 top-7 h-12 w-14 rounded-full ${tree.leaf1} shadow-md`}
        />
        <motion.div
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.14, ...stemTransition }}
          className={`absolute right-3 top-8 h-12 w-14 rounded-full ${tree.leaf2} shadow-md`}
        />
        <motion.div
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.18, ...stemTransition }}
          className={`absolute left-1/2 top-0 h-16 w-16 -translate-x-1/2 rounded-full ${tree.leaf3} shadow-lg`}
        />
        <motion.div
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{
            scale: progress > 45 ? 1 : 0.65,
            opacity: progress > 45 ? 1 : 0.55,
          }}
          transition={{ delay: 0.22, ...stemTransition }}
          className={`absolute left-6 top-12 h-10 w-13 rounded-full ${tree.leaf4} shadow-md`}
        />
      </motion.div>
    </div>
  );
}
