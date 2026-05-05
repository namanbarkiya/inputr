import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  publicDir: 'public',
  outDir: '.output',

  manifest: {
    name: 'Inputr',
    description:
      'Fix any image upload box on the web. Detects constraints, lets you upload and crop to exactly the right size.',
    version: '0.1.0',
    permissions: ['sidePanel', 'storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Inputr — click to open',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
    icons: {
      16: 'icon/16.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },

  vite: () => ({
    build: {
      sourcemap: true,
    },
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    },
  }),

  zip: {
    artifactTemplate: 'inputr-{{version}}-{{browser}}.zip',
  },
});
