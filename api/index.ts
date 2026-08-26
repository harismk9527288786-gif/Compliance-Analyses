import app from '../server';

export default function handler(req: any, res: any) {
  try {
    if (req.url && !req.url.startsWith('/api/') && req.url !== '/api') {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    return app(req, res);
  } catch (err: any) {
    console.error('Unhandled Vercel Serverless Function error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: err?.message || String(err),
      });
    }
  }
}
