import { Playfair_Display, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
})

export const metadata = {
  title: 'NCLT Legal Copilot',
  description: 'AI-powered NCLT order analysis — IBC 2016',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
