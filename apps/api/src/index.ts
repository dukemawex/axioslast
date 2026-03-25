import './config/env'; // Validate env first
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { env } from './config/env';
import app from './app';

async function start(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');

    await redis.connect();
    await redis.ping();
    console.log('✅ Redis connected');

    app.listen(env.PORT, () => {
      console.log(`🚀 Axios Pay API running on port ${env.PORT}`);
      console.log(`   Health: http://localhost:${env.PORT}/health`);
      console.log(`   Environment: ${env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
}

start();
