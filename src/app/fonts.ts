import localFont from 'next/font/local';

export const wenkai = localFont({
  src: './fonts/lxgw-wenkai-subset.woff2',
  variable: '--font-wenkai',
  display: 'swap',
  preload: true,
});
