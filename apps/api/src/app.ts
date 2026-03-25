import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import walletRoutes from './routes/wallet.routes';
import ratesRoutes from './routes/rates.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(compression());
app.use(morgan('combined'));

// Webhook route needs raw body for HMAC verification
app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }), (req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
  req.rawBody = req.body as Buffer;
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ service: 'Axios Pay API', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/rates', ratesRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'The requested resource was not found' });
});

app.use(errorMiddleware);

export default app;
