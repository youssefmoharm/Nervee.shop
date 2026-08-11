import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await requestPasswordReset(email)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    setSent(true)
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="nv-heading text-5xl mb-2">Reset Password</h1>
        <p className="text-navy/60 mb-8">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {sent ? (
          <p className="text-sm">
            If an account exists for <strong>{email}</strong>, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Send Reset Link'}
            </button>
          </form>
        )}

        <Link to="/login" className="inline-block mt-6 text-sm text-navy/60 hover:text-navy underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
