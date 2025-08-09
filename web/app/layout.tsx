import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Crypto Analyzer",
  description: "Search and analyze crypto symbols",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <main className='layout'>
          <header className='layout__header'>
            <h1 className='layout__title'>Crypto Analyzer</h1>
          </header>
          <section className='layout__content'>{children}</section>
        </main>
      </body>
    </html>
  );
}
