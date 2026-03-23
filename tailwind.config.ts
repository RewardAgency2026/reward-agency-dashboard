import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: "hsl(222, 47%, 11%)",
          active: "hsl(236, 85%, 55%)",
          hover: "hsl(222, 47%, 16%)",
          text: "hsl(215, 20%, 65%)",
          border: "hsl(222, 47%, 17%)",
        },
      },
      width: {
        sidebar: "240px",
      },
    },
  },
  plugins: [],
};
export default config;
