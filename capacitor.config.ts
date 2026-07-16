import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.rinde.finance",
  appName: "Rinde",
  webDir: "out",
  server: {
    // Mobile app talks to the remote Vercel API via NEXT_PUBLIC_API_BASE_URL
    // (baked into the static export at build time). Do not point Capacitor
    // server.url at localhost for production builds.
    androidScheme: "https",
  },
};

export default config;
