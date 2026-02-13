import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Police Database Thefts Over $5,000 (UofT St. George)",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
