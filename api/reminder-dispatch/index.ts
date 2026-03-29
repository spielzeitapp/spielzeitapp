export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { jobId } = req.body || {};

    if (!jobId) {
      return res.status(400).json({ ok: false, error: 'Missing jobId' });
    }

    console.log('🚀 Reminder dispatch triggered:', jobId);

    return res.status(200).json({
      ok: true,
      jobId,
      message: 'Reminder dispatch läuft',
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Unknown error',
    });
  }
}