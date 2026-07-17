import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Fraunces, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  preload: false,
  adjustFontFallback: true,
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  preload: false,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "OpenBalance",
  description: "OpenBalance — finanzas personales, resumen semanal y mensual",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OpenBalance",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e2db" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1d20" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Opt into dynamic rendering so middleware nonces are applied to scripts (H9).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Theme FOUC guard */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("openbalance-theme");var dark=t==="dark"||((t==="system"||!t)&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}else{document.documentElement.style.colorScheme="light"}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${fraunces.variable} ${sourceSans.variable} ${sourceSans.className} ${ibmPlexMono.variable} antialiased`}
      >
        <AuthSessionProvider>
          <AppShell>{children}</AppShell>
        </AuthSessionProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
