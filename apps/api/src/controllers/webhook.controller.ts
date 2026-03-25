import { Request, Response, NextFunction } from 'express';
import { verifyWebhookSignature } from '../services/interswitch.service';
import { completeDeposit } from '../services/wallet.service';

export async function interswitchWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-interswitch-signature'] as string || '';
    const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body));

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      res.status(200).json({ message: 'OK' }); // Always return 200
      return;
    }

    const { responseCode, transactionReference } = req.body;

    if (responseCode === '00' && transactionReference) {
      await completeDeposit(transactionReference);
    }

    res.status(200).json({ message: 'OK' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ message: 'OK' }); // Always return 200
  }
}
