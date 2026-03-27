'use client';
import { Plane } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export default function TravelPage() {
  const transactions: Array<{ id: string; airline: string; route: string; flightNo: string; travelDate: string; price: number; currency: string }> = [];

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-text-primary mb-6">Travel History</h1>
      {transactions.length ? (
        <div className="space-y-3">
          {transactions.map((tx: { id: string; airline: string; route: string; flightNo: string; travelDate: string; price: number; currency: string }) => (
            <Card key={tx.id}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary">{tx.route}</p>
                  <p className="text-sm text-text-secondary">{tx.airline} • {tx.flightNo} • {new Date(tx.travelDate).toLocaleDateString()}</p>
                </div>
                <p className="text-sm text-brand-amber font-medium">{tx.currency} {tx.price.toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-8">
          <Plane className="w-10 h-10 text-brand-amber mx-auto mb-3" />
          <p className="font-semibold text-text-primary">No travel activity yet</p>
          <p className="text-sm text-text-secondary mt-1">Your cross-border travel swaps and spending records will appear here.</p>
        </Card>
      )}
      <Card className="mt-4">
        <h2 className="font-semibold text-text-primary mb-2">Conference travel use case</h2>
        <p className="text-sm text-text-secondary">
          Traveling from Nigeria to Nairobi for a conference? Axios Pay&apos;s cross-border FX (powered through partner banks
          and Interswitch/Quickteller rails) lets you swap directly from NGN to KES so you can pay for hotels, rides, and meals
          in local currency — no USD conversion required.
        </p>
      </Card>
    </div>
  );
}
