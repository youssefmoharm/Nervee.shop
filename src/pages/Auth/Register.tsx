import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import PasswordStrengthIndicator from '../../components/PasswordStrengthIndicator'

export default function Register() {
  const { signUp } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!dob) {
      setError('Please enter your date of birth.')
      return
    }
    if (!gender) {
      setError('Please select your gender.')
      return
    }

    setLoading(true)
    const meta = { date_of_birth: dob, gender, profile_photo_name: profilePhoto?.name ?? null }
    const { error } = await signUp(email, password, firstName, lastName, meta)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8 text-center">
        <h1 className="nv-heading text-4xl mb-4">Check Your Email</h1>
        <p className="text-navy/60 max-w-md mx-auto">
          We sent a confirmation link to <strong>{email}</strong>. Verify your email, then sign in to your account.
        </p>
        <Link to="/login" className="inline-block mt-8 nv-eyebrow underline">
          Back to Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="nv-heading text-5xl mb-2">Create Account</h1>
        <p className="text-navy/60 mb-8">Join NERVE for faster checkout and order tracking.</p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">First Name</span>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Last Name</span>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              />
            </label>
          </div>
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
              id="register-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
            />
            <span className="text-xs text-navy/40 mt-1 block">At least 8 characters.</span>

            {/* Password strength guidance */}
            <div className="mt-3">
              <PasswordStrengthIndicator password={password} showRequirements={true} />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Confirm Password</span>
            <input
              id="register-confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Date of Birth</span>
              <input
                id="register-dob"
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Gender</span>
              <select
                id="register-gender"
                required
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors bg-white"
              >
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Profile Photo (optional)</span>
            <input
              id="register-photo"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setProfilePhoto(file)
                if (file) setPhotoPreview(URL.createObjectURL(file))
              }}
              className="w-full text-sm"
            />
            {photoPreview && (
              <img src={photoPreview} alt="Profile preview" className="mt-2 w-24 h-24 object-cover rounded-full" />
            )}
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-navy/60">
          Already have an account?{' '}
          <Link to="/login" className="underline hover:text-navy">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
