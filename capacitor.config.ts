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
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#e6e2db",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#803e2f",
    },
  },
};

export default config;
