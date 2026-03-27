'use client';
import { useQuery } from '@tanstack/react-query';
import { Plane } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

export default function TravelPage() {
  const mockFlights = [
    { id: 'AXP-FLT-001', airline: 'Air Peace', route: 'Lagos → Nairobi', flightNo: 'P4 871', travelDate: '2026-03-02', price: 845000, currency: 'NGN' },
    { id: 'AXP-FLT-002', airline: 'Kenya Airways', route: 'Nairobi → Accra', flightNo: 'KQ 512', travelDate: '2026-02-20', price: 622000, currency: 'NGN' },
    { id: 'AXP-FLT-003', airline: 'South African Airways', route: 'Accra → Johannesburg', flightNo: 'SA 053', travelDate: '2026-01-11', price: 1195000, currency: 'NGN' },
    { id: 'AXP-FLT-004', airline: 'RwandAir', route: 'Kigali → Lagos', flightNo: 'WB 220', travelDate: '2025-12-15', price: 568000, currency: 'NGN' },
  ];

  const { data: airlinePrices, isLoading: pricesLoading } = useQuery({
    queryKey: ['travel', 'mock-airline-prices'],
    queryFn: async () => ({
      'Air Peace': { avg: 860000, min: 530000 },
      'Kenya Airways': { avg: 710000, min: 480000 },
      'South African Airways': { avg: 1230000, min: 900000 },
      RwandAir: { avg: 610000, min: 420000 },
      'Ethiopian Airlines': { avg: 780000, min: 500000 },
    }),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', 'travel'],
    queryFn: async () => ({ transactions: mockFlights }),
  });

  const transactions = data?.transactions || [];

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-text-primary mb-6">Travel History</h1>
      {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : error ? (
        <Card className="border-error bg-red-50 text-error">Could not load travel-related transactions.</Card>
      ) : transactions.length ? (
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
        <h2 className="font-semibold text-text-primary mb-3">Mock airline price data</h2>
        {pricesLoading ? (
          <Spinner />
        ) : (
          <div className="space-y-2">
            {Object.entries(airlinePrices || {}).map(([airline, info]) => (
              <div key={airline} className="flex justify-between text-sm">
                <span className="text-text-secondary">{airline}</span>
                <span className="text-text-primary">Avg: NGN {info.avg.toLocaleString()} • From: NGN {info.min.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
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
