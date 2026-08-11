import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    navigate(location.state?.from ?? '/account')
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="nv-heading text-5xl mb-2">Sign In</h1>
        <p className="text-navy/60 mb-8">Welcome back to NERVE.</p>

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
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
            />
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-navy/60 hover:text-navy underline">
            Forgot password?
          </Link>
          <Link to="/register" className="text-navy/60 hover:text-navy underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  )
}
