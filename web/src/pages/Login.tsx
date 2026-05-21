import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, Eye, EyeOff, MailCheck, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type Mode = 'sign_in' | 'sign_up'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('sign_in')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // After successful sign-up Supabase sends a verification email; show that
  // state instead of bouncing the user to /dashboard (where they'd hit RLS
  // errors because the session isn't established until they click the link).
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'sending'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'sign_up') {
        // Use supabase directly so we can inspect the response and detect
        // whether email confirmation was required.
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        // If the project requires email confirmation (default), `session`
        // is null and `user.identities` is empty — show check-your-inbox UI.
        if (!data.session) {
          setSignedUpEmail(email)
        } else {
          // Project has email confirmation disabled — proceed straight in.
          navigate('/dashboard')
        }
      } else {
        await signIn(email, password)
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function resendVerification() {
    if (!signedUpEmail) return
    setResendStatus('sending')
    try {
      await supabase.auth.resend({ type: 'signup', email: signedUpEmail })
      setResendStatus('sent')
      setTimeout(() => setResendStatus('idle'), 4000)
    } catch {
      setResendStatus('idle')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <UtensilsCrossed className="h-12 w-12 text-brand-700 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-brand-700">NutriSense AI</h1>
          <p className="text-gray-400 text-sm mt-1">
            {signedUpEmail ? 'Check your email' : mode === 'sign_up' ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        {signedUpEmail ? (
          // ── Post sign-up: check-your-email state ───────────────────────
          <div className="space-y-4 text-center">
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 flex flex-col items-center gap-2">
              <MailCheck className="h-10 w-10 text-brand-700" />
              <p className="text-sm font-semibold text-gray-800">Verification email sent</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                We sent a confirmation link to <strong className="text-gray-800">{signedUpEmail}</strong>.
                Click the link in that email, then come back and sign in.
              </p>
            </div>

            <div className="text-xs text-gray-500">
              Didn't get it? Check your spam folder, or{' '}
              <button
                onClick={resendVerification}
                disabled={resendStatus !== 'idle'}
                className="text-brand-700 hover:underline disabled:opacity-50"
              >
                {resendStatus === 'sending' ? 'sending…' :
                 resendStatus === 'sent'    ? 'sent ✓' :
                                              'resend the email'}
              </button>.
            </div>

            <button
              onClick={() => { setSignedUpEmail(null); setMode('sign_in'); setPassword('') }}
              className="w-full bg-brand-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-800 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} /> I've verified — sign me in
            </button>
          </div>
        ) : (
          // ── Sign-in / sign-up form ─────────────────────────────────────
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} required minLength={6}
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === 'sign_up' && (
                  <p className="text-xs text-gray-400 mt-1">At least 6 characters.</p>
                )}
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-brand-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Please wait…' : mode === 'sign_up' ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <button
              onClick={() => { setMode(mode === 'sign_up' ? 'sign_in' : 'sign_up'); setError('') }}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 w-full text-center transition-colors"
            >
              {mode === 'sign_up' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
