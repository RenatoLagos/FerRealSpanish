// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
    site: 'https://ferrealspanish.com',
    output: 'server',
    adapter: vercel({
        webAnalytics: {
            enabled: true,
        }
    }),
    integrations: [tailwind()],
    compressHTML: true,
    build: {
        inlineStylesheets: 'auto'
    }
});