import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Crypto Analyzer",
  description: "Search and analyze crypto symbols",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <main className='layout'>
          <header className='layout__header'>
            <Link href='/' className='layout__brand' aria-label='Home'>
              <Image src='/favicon.ico' alt='' width={24} height={24} priority />
              <h1 className='layout__title'>Huyche Analyzer</h1>
            </Link>
          </header>
          <section className='layout__content'>{children}</section>
        </main>
      </body>
    </html>
  );
}
