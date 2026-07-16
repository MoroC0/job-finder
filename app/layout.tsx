import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Job Finder',
  description: 'Personalized job search dashboard built with Next.js and TypeScript',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
