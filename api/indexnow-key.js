// api/indexnow-key.js
// Serves the IndexNow key verification file at /indexcore.txt
// Required by Bing, Yandex, Seznam, and other IndexNow engines
// to verify you own the domain before accepting URL submissions.
//
// The key "indexcore" matches the INDEXNOW_KEY constant in LinkCore.
// If you change the key in LinkCore, update it here too.

export const config = { runtime: 'edge' };

export default function handler() {
  return new Response('indexcore', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
