import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { Toaster } from "sonner";
import { AppFooter } from "@/components/app-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "linear.dude.fi | Linear issues shared with Dude clients",
  description: "See your tasks being worked on in real time. Linear issues shared with Dude clients via linear.dude.fi.",
  keywords: [
    "Linear feedback forms",
    "Linear client feedback",
    "SteelSync alternative",
    "Lindie alternative",
    "free Linear integration",
    "open source Linear",
    "Linear feedback collection",
    "Linear customer requests",
    "Linear issue forms"
  ],
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }
    ],
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'android-chrome-192x192', url: '/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/android-chrome-512x512.png' }
    ]
  },
  openGraph: {
    title: "linear.dude.fi - Linear issues shared with Dude clients",
    description: "See your tasks being worked on in real time.",
    type: "website",
    url: "https://linear.dude.fi",
    siteName: "linear.dude.fi",
    images: [
      {
        url: "https://linear.dude.fi/og-image.png",
        width: 1200,
        height: 630,
        alt: "linear.dude.fi - Linear issues shared with Dude clients"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "linear.dude.fi - Linear issues shared with Dude clients",
    description: "See your tasks being worked on in real time.",
    images: ["https://linear.dude.fi/og-image.png"],
    creator: "@curiousgeorgios"
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('linear-integration-theme') === 'dark' || (!('linear-integration-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          defaultTheme="system"
          storageKey="linear-integration-theme"
        >
          <AuthProvider>
            {children}
            <AppFooter />
          </AuthProvider>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
