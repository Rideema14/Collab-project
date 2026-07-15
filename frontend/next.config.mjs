/** @type {import('next').NextConfig} */
const nextConfig = {
  // StrictMode double-invokes render/effects in DEV only — great for catching bugs
  // but it doubles main-thread work in dev (which is what a dev-server Lighthouse
  // measures). Off for a faster dev profile; production is unaffected either way.
  reactStrictMode: false,
  // Tree-shake heavy barrel imports so routes only ship the icons/animations they
  // use — trims unused JavaScript (a top Lighthouse diagnostic).
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
  // Allows an isolated build output (e.g. NEXT_DIST_DIR=.next-prod) so a production
  // build never collides with a running `next dev` on the same .next folder.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  async redirects() {
    return [
      // The legacy /projects/* surface was removed in the redesign. Redirect old
      // URLs (bookmarks, links) to the new /list route. A backend project N maps
      // to the client list id `list-N`; any trailing view segment is dropped.
      {
        source: '/projects/:projectId(\\d+)/:view*',
        destination: '/list/list-:projectId',
        permanent: false,
      },
      { source: '/projects', destination: '/home', permanent: false },
    ];
  },
};

export default nextConfig;
