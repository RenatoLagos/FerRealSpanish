import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const baseURL = site?.href || 'https://ferrealspanish.com';
  
  // Define todas las páginas de tu sitio
  const pages = [
    {
      url: '',
      lastmod: new Date().toISOString(),
      changefreq: 'monthly',
      priority: '1.0'
    },
    {
      url: 'about',
      lastmod: new Date().toISOString(),
      changefreq: 'monthly',
      priority: '0.8'
    },
    {
      url: 'schedule-class',
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: '0.9'
    },
    {
      url: 'contact',
      lastmod: new Date().toISOString(),
      changefreq: 'monthly',
      priority: '0.7'
    }
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `
  <url>
    <loc>${baseURL}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}; 