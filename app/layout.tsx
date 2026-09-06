import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({ subsets: ['latin'], variable: '--font-rubik', display: 'swap' });

export const metadata: Metadata = {
  title: "Ecosistema Fitness Factory",
  description: "Plataforma Administrativa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${rubik.variable} h-full antialiased`}>
      <body className={`${rubik.variable} ${rubik.className} antialiased text-white min-h-screen bg-black`}>
        {children}
      </body>
    </html>
  );
}
