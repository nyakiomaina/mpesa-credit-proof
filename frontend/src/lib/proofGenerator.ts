interface Transaction {
  transaction_date: string;
  amount: number;
  transaction_type: string;
  customer_hash: string | null;
}

interface ProofMetrics {
  creditScore: number;
  monthlyVolume: number;
  averageTicketSize: number;
  customerDiversityScore: number;
  growthTrend: 'growing' | 'stable' | 'declining';
  consistencyScore: number;
  activityFrequency: 'high' | 'medium' | 'low';
}

export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MPC-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function calculateProofMetrics(transactions: Transaction[]): ProofMetrics {
  if (transactions.length === 0) {
    return {
      creditScore: 0,
      monthlyVolume: 0,
      averageTicketSize: 0,
      customerDiversityScore: 0,
      growthTrend: 'stable',
      consistencyScore: 0,
      activityFrequency: 'low',
    };
  }

  const sortedTxns = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  // Calculate monthly volume based on actual transaction period (like RISC Zero does)
  // Not "last 30 days from now", but average monthly volume from the transaction period
  const firstDate = new Date(sortedTxns[0].transaction_date);
  const lastDate = new Date(sortedTxns[sortedTxns.length - 1].transaction_date);
  const daysInPeriod = Math.max(1, Math.floor((lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);

  const totalVolume = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const monthlyVolume = (totalVolume / daysInPeriod) * 30;

  const averageTicketSize = totalVolume / (transactions.length || 1);

  const uniqueCustomers = new Set(
    transactions.map((t) => t.customer_hash).filter(Boolean)
  ).size;
  const customerDiversityScore = Math.min(100, Math.floor((uniqueCustomers / 50) * 100));

  const firstHalfTxns = sortedTxns.slice(0, Math.floor(sortedTxns.length / 2));
  const secondHalfTxns = sortedTxns.slice(Math.floor(sortedTxns.length / 2));

  const firstHalfVolume = firstHalfTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const secondHalfVolume = secondHalfTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  let growthTrend: 'growing' | 'stable' | 'declining' = 'stable';
  if (secondHalfVolume > firstHalfVolume * 1.2) {
    growthTrend = 'growing';
  } else if (secondHalfVolume < firstHalfVolume * 0.8) {
    growthTrend = 'declining';
  }

  const daysBetweenFirst = Math.floor(
    (new Date(sortedTxns[sortedTxns.length - 1].transaction_date).getTime() -
      new Date(sortedTxns[0].transaction_date).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  const avgTxnsPerDay = transactions.length / (daysBetweenFirst || 1);
  const consistencyScore = Math.min(100, Math.floor(avgTxnsPerDay * 10));

  let activityFrequency: 'high' | 'medium' | 'low' = 'low';
  if (avgTxnsPerDay >= 5) {
    activityFrequency = 'high';
  } else if (avgTxnsPerDay >= 2) {
    activityFrequency = 'medium';
  }

  const creditScore = Math.floor(
    consistencyScore * 0.3 +
      (monthlyVolume > 100000 ? 100 : (monthlyVolume / 100000) * 100) * 0.3 +
      customerDiversityScore * 0.2 +
      (growthTrend === 'growing' ? 100 : growthTrend === 'stable' ? 70 : 40) * 0.2
  );

  return {
    creditScore: Math.min(100, Math.max(0, creditScore)),
    monthlyVolume,
    averageTicketSize,
    customerDiversityScore,
    growthTrend,
    consistencyScore,
    activityFrequency,
  };
}
