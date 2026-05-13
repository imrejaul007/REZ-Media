export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://adbazaar.in'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/vendor/', '/buyer/', '/admin/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
