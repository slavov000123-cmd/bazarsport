import MobileApp from './MobileApp';
export const metadata = { title: 'BAZARSPORT · Приложение', manifest: '/mobile/manifest.webmanifest', appleWebApp: { capable: true, title: 'BAZARSPORT', statusBarStyle: 'black-translucent' as const }, icons: { apple: '/mobile/icon-192.png' } };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0a1110', viewportFit: 'cover' };
export default function Page() { return <MobileApp/>; }
