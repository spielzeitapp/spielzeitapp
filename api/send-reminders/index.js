/**
 * Vercel Serverless: /api/send-reminders (CommonJS)
 */
module.exports = async (req, res) => {
  try {
    return res.status(200).json({
      ok: true,
      message: 'Send reminders works',
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
};
