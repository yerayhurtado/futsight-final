import type { Metadata } from "next";
import { Inter, Poppins, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Header from "./Header/header";
import Footer from "./Footer/footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FutSight - Advanced Football Analytics Platform",
  description: "Descubre insights profundos de jugadores, análisis de partidos en tiempo real y estrategias tácticas con la plataforma de analytics más avanzada del fútbol profesional.",
  keywords: ["football analytics", "soccer statistics", "player analysis", "match analytics", "football data"],
  authors: [{ name: "FutSight Team" }],
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "FutSight - Advanced Football Analytics Platform",
    description: "La plataforma de analytics más avanzada del fútbol profesional",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased bg-[#020812] text-white flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}