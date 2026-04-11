import Link from 'next/link';
import { SessionHistoryList } from '@/components/history/SessionHistoryList';

export default function HistoryPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white px-4 pt-safe-top pb-safe-bottom">
      {/* Header with back button */}
      <div className="flex items-center gap-3 pt-4 pb-6">
        <Link href="/checkin" className="text-gray-400 text-sm">
          &larr; Back
        </Link>
        <h1 className="text-white text-xl font-semibold">Session History</h1>
      </div>

      <SessionHistoryList />
    </div>
  );
}
