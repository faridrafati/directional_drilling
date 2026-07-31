/** @type {import('tailwindcss').Config} */
import colors from "tailwindcss/colors";
import defaultTheme from "tailwindcss/defaultTheme";

/**
 * Rock Drill design tokens — "Data-Dense Dashboard" system (ui-ux-pro-max):
 * deep-blue primary #1E40AF, amber accent #D97706, cool slate neutrals on a
 * #F8FAFC canvas, Fira Sans for UI text + Fira Code for data/mono.
 *
 * The retheme is done AT THE TOKEN LEVEL on purpose: every component in the app
 * styles itself with `blue-*` (actions/active states) and `gray-*` (chrome), so
 * remapping those two scales here restyles all pages consistently without
 * touching component files.
 *
 *   gray  → slate      cooler, more technical neutrals (bg-gray-50 = #F8FAFC)
 *   blue-600/700       deepened to the primary pair #1E40AF / #1E3A8A
 *                      (8.7:1 / 10.3:1 on white — WCAG AAA for buttons/links)
 *   amber-600          #D97706 is Tailwind's default — used as the accent, so
 *                      no remap needed; use `amber-*` for highlights/CTAs.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: colors.slate,
        blue: {
          ...colors.blue,
          600: "#1E40AF", // primary   (was #2563EB)
          700: "#1E3A8A", // primary hover / active text (was #1D4ED8)
        },
      },
      fontFamily: {
        sans: ['"Fira Sans"', ...defaultTheme.fontFamily.sans],
        mono: ['"Fira Code"', ...defaultTheme.fontFamily.mono],
      },
    },
  },
  plugins: [],
};
