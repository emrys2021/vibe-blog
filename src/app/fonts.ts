import localFont from 'next/font/local';

export const jetbrainsMono = localFont({
  src: [
    {
      path: './fonts/jetbrains-mono-latin-var.woff2',
      weight: '100 800',
      style: 'normal',
    },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: true,
});

export const wenkai = localFont({
  src: './fonts/lxgw-wenkai-subset.woff2',
  variable: '--font-wenkai',
  display: 'swap',
  preload: true,
});
