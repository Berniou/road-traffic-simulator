export function createNotifierClient({ url, fetch = globalThis.fetch }) {
  const notifyUrl = new URL('/notify', url);

  return {
    async notify(position) {
      const response = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(position),
      });

      if (!response.ok) {
        throw new Error(`Notificateur indisponible: HTTP ${response.status}`);
      }
    },
  };
}
