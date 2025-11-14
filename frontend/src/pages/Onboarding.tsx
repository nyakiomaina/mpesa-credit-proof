import { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';

type Step = 'account' | 'upload' | 'complete';

interface TransactionRow {
  date?: string;
  type?: string;
  amount?: string;
  balance?: string;
  details?: string;
}

export function Onboarding() {
  const [step, setStep] = useState<Step>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [parseStatus, setParseStatus] = useState('');
  const [transactionCount, setTransactionCount] = useState(0);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error } = await signUp(contactEmail, password, {
      business_name: businessName,
      contact_email: contactEmail,
      kra_pin: kraPin || undefined,
      registration_number: registrationNumber || undefined,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setStep('upload');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseStatus('Parsing file...');

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
        }

        setParseStatus(`Transactions detected: ${validTransactions.length}`);
      },
      error: () => {
        setError('Failed to parse file. Please ensure it is a valid CSV.');
        setParseStatus('');
      },
    });
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as TransactionRow[];
          const validTransactions = data.filter(row => row.date && row.amount);

        const { data: upload, error: uploadError } = await (supabase
          .from('transaction_uploads')
          .insert({
              business_id: user.id,
              file_name: file.name,
              transaction_count: validTransactions.length,
              date_range_start: dateRange.start || null,
              date_range_end: dateRange.end || null,
              total_volume: validTransactions.reduce((sum, row) => {
                const amount = parseFloat(row.amount || '0');
                return sum + (isNaN(amount) ? 0 : Math.abs(amount));
              }, 0),
              status: 'parsed',
              processed_at: new Date().toISOString(),
            } as any)
            .select()
            .single()) as any;

          if (uploadError) throw uploadError;

          const transactions = validTransactions.map(row => {
            // Map M-Pesa CSV types to standard transaction types
            let txType = row.type || 'unknown';
            if (txType.toLowerCase() === 'received') {
              txType = 'Payment';
            } else if (txType.toLowerCase() === 'reversal') {
              txType = 'Reversal';
            } else {
              // For 'sent', 'withdrawal', etc., map to 'Payment' for now
              // or you could filter them out if they shouldn't count
              txType = 'Payment';
            }

            return {
              upload_id: (upload as any).id,
              business_id: user.id,
              transaction_date: new Date(row.date!).toISOString(),
              transaction_type: txType,
              amount: parseFloat(row.amount || '0'),
              balance_after: row.balance ? parseFloat(row.balance) : null,
              customer_hash: null,
            };
          });

          const { error: txError } = await (supabase
            .from('transactions')
            .insert(transactions as any) as any) as any;

          if (txError) throw txError;

          setLoading(false);
          setStep('complete');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <ShieldCheck className="w-10 h-10 text-green-600" />
            <span className="text-2xl font-bold text-slate-900">M-Pesa Credit Proof</span>
          </Link>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Business Onboarding</h2>
          <p className="text-slate-600">Get started in just a few steps</p>
        </div>

        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step === 'account' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600'
            }`}>
              1
            </div>
            <div className={`w-24 h-1 ${step !== 'account' ? 'bg-green-600' : 'bg-slate-300'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step === 'upload' ? 'bg-green-600 text-white' : step === 'complete' ? 'bg-green-100 text-green-600' : 'bg-slate-300 text-slate-600'
            }`}>
              2
            </div>
            <div className={`w-24 h-1 ${step === 'complete' ? 'bg-green-600' : 'bg-slate-300'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step === 'complete' ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-600'
            }`}>
              3
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 'account' && (
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Account Details</h3>
              <form onSubmit={handleAccountSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Your Business Ltd"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="contact@business.com"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      KRA PIN (optional)
                    </label>
                    <input
                      type="text"
                      value={kraPin}
                      onChange={(e) => setKraPin(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      placeholder="A123456789Z"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Registration Number (optional)
                    </label>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      placeholder="BN12345"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Continue to Upload'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-slate-600">
                  Already have an account?{' '}
                  <Link to="/signin" className="text-green-600 font-semibold hover:underline">
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Upload M-Pesa Data</h3>
              <form onSubmit={handleUploadSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <label className="cursor-pointer">
                    <span className="text-green-600 font-semibold hover:underline">
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
                  <p className="text-sm text-slate-500 mt-2">CSV or Excel files only</p>
                </div>

                {file && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-semibold text-slate-900 mb-2">{file.name}</p>
                    {parseStatus && <p className="text-sm text-slate-600">{parseStatus}</p>}
                    {transactionCount > 0 && (
                      <div className="mt-2 text-sm text-slate-600">
                        <p>Date range: {dateRange.start} to {dateRange.end}</p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !file || transactionCount === 0}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Complete Setup'
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Setup Complete!</h3>
              <p className="text-slate-600 mb-8">
                Your account is ready. You can now generate credit proofs.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
