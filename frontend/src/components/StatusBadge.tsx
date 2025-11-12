interface StatusBadgeProps {
  status: 'generating' | 'valid' | 'expired' | 'failed' | 'pending' | 'parsed';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    generating: 'bg-blue-100 text-blue-800',
    valid: 'bg-green-100 text-green-800',
    expired: 'bg-slate-100 text-slate-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    parsed: 'bg-green-100 text-green-800',
  };

  const labels = {
    generating: 'Generating',
    valid: 'Valid',
    expired: 'Expired',
    failed: 'Failed',
    pending: 'Pending',
    parsed: 'Parsed',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
