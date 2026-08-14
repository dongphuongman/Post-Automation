import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { NotifyHost } from '@/components/ui/Notify';

export const metadata: Metadata = {
  title: 'Marketing Automation',
  description: 'AI-powered content marketing pipeline for Facebook',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {/* Áp theme đã lưu TRƯỚC khi paint để tránh nhấp nháy (FOUC). 'system' = xoá attr, để media query quyết định. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();` }} />
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
        <NotifyHost />
      </body>
    </html>
  );
}
