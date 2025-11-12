import { useState, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Papa from 'papaparse';
import { Upload as UploadIcon, Loader2, CheckCircle2, FileText } from 'lucide-react';

interface TransactionRow {
  date?: string;
  type?: string;
  amount?: string;
  balance?: string;
  details?: string;
}

export function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [parseStatus, setParseStatus] = useState('');
  const [transactionCount, setTransactionCount] = useState(0);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [totalVolume, setTotalVolume] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseStatus('Parsing file...');
    setError('');

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as TransactionRow[];
        const validTransactions = data.filter(row => row.date && row.amount);

        setTransactionCount(validTransactions.length);

        if (validTransactions.length > 0) {
          const dates = validTransactions
            .map(row => row.date)
            .filter(Boolean)
            .sort();

          setDateRange({
            start: dates[0] || '',
            end: dates[dates.length - 1] || '',
          });

          const volume = validTransactions.reduce((sum, row) => {
            const amount = parseFloat(row.amount || '0');
            return sum + (isNaN(amount) ? 0 : Math.abs(amount));
          }, 0);
          setTotalVolume(volume);
        }

        setParseStatus(`Successfully parsed ${validTransactions.length} transactions`);
      },
      error: () => {
        setError('Failed to parse file. Please ensure it is a valid CSV.');
        setParseStatus('');
      },
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    setLoading(true);
    setError('');

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as TransactionRow[];
          const validTransactions = data.filter(row => row.date && row.amount);

          const { data: upload, error: uploadError } = await supabase
            .from('transaction_uploads')
            .insert({
              business_id: user.id,
              file_name: file.name,
              transaction_count: validTransactions.length,
              date_range_start: dateRange.start || null,
              date_range_end: dateRange.end || null,
              total_volume: totalVolume,
              status: 'parsed',
              processed_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (uploadError) throw uploadError;

          const transactions = validTransactions.map(row => ({
            upload_id: upload.id,
            business_id: user.id,
            transaction_date: new Date(row.date!).toISOString(),
            transaction_type: row.type || 'unknown',
            amount: parseFloat(row.amount || '0'),
            balance_after: row.balance ? parseFloat(row.balance) : null,
            customer_hash: null,
          }));

          const { error: txError } = await supabase
            .from('transactions')
            .insert(transactions);

          if (txError) throw txError;

          setLoading(false);
          setSuccess(true);

          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
        },
        error: () => {
          setError('Failed to process file');
          setLoading(false);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  if (success) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Upload Successful!</h2>
          <p className="text-slate-600 mb-4">Your M-Pesa data has been processed.</p>
          <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Upload M-Pesa Data</h1>
          <p className="text-slate-600">Upload your transaction statements to generate credit proofs</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-4">
                Transaction Data File
              </label>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-green-500 transition-colors">
                <UploadIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <label className="cursor-pointer">
                  <span className="text-green-600 font-semibold text-lg hover:underline">
                    Choose a file
                  </span>
                  <span className="text-slate-600"> or drag and drop</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-slate-500 mt-3">CSV or Excel files only</p>
                <p className="text-xs text-slate-400 mt-2">
                  Your file should contain columns for date, amount, and transaction type
                </p>
              </div>
            </div>

            {file && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <FileText className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 mb-3">{file.name}</p>

                    {parseStatus && (
                      <p className="text-sm text-green-800 mb-3">{parseStatus}</p>
                    )}

                    {transactionCount > 0 && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Transactions:</span>
                          <span className="font-semibold text-slate-900">{transactionCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Date Range:</span>
                          <span className="font-semibold text-slate-900">
                            {dateRange.start} to {dateRange.end}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Total Volume:</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(totalVolume)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Privacy Notice</h3>
              <p className="text-sm text-blue-800">
                Your transaction data is stored securely and will only be used to generate
                zero-knowledge proofs. Lenders will never see your raw transaction details.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !file || transactionCount === 0}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-5 h-5" />
                    Upload Data
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
