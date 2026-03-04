
const https = require('https');

const urls = [
  'https://meetezri-live-api.vercel.app',
  'https://meetezri-live-api.vercel.app/api/health',
  'https://meetezri-live.vercel.app',
  'https://meetezri-live.vercel.app/api/health',
  'https://meet-ezri-api.vercel.app',
  'https://meet-ezri-api.vercel.app/api/health',
  'https://meetezri-api.vercel.app',
  'https://meetezri-api.vercel.app/api/health',
  'https://meetezri-live-web.vercel.app/api/health'
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(`${url}: ${res.statusCode}`);
    if (res.statusCode === 200) {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => console.log(`  Body (${url}): ${data.substring(0, 100)}`));
    }
  }).on('error', (e) => {
    console.log(`${url}: Error - ${e.message}`);
  });
});
