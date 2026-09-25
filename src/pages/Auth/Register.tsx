import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PasswordStrengthIndicator from '../../components/PasswordStrengthIndicator';
import { useSEO } from '../../hooks/useSEO';
import { useI18n } from '../../lib/i18n';

export default function Register() {
  const { signUp } = useAuth();
  const { t } = useI18n();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useSEO({
    title: 'Create Account — NERVE',
    description:
      'Create a NERVE account to track orders, save your wishlist, and check out faster.',
    robots: 'noindex, nofollow',
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Strong password validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.');
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      setError('Password must contain at least one special character.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!dob) {
      setError('Please enter your date of birth.');
      return;
    }
    if (!gender) {
      setError('Please select your gender.');
      return;
    }

    setLoading(true);
    const meta = { date_of_birth: dob, gender, profile_photo_name: profilePhoto?.name ?? null };
    const { error } = await signUp(email, password, firstName, lastName, meta);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8 text-center">
        <h1 className="nv-heading text-4xl mb-4">{t('Check Your Email')}</h1>
        <p className="text-navy/60 max-w-md mx-auto">
          {t('We sent a confirmation link to')} <strong>{email}</strong>.{' '}
          {t('Verify your email, then sign in to your account.')}
        </p>
        <Link to="/login" className="inline-block mt-8 nv-eyebrow underline">
          {t('Back to Sign In')}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="nv-heading text-5xl mb-2">{t('Create Account')}</h1>
        <p className="text-navy/60 mb-8">
          {t('Join NERVE for faster checkout and order tracking.')}
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">
                {t('First Name')}
              </span>
              <input
                required
                data-testid="register-firstName-input"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">
                {t('Last Name')}
              </span>
              <input
                required
                data-testid="register-lastName-input"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Email')}</span>
            <input
              type="email"
              required
              data-testid="register-email-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Password')}</span>
            <input
              id="register-password"
              data-testid="register-password-input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
            />
            <span className="text-xs text-navy/60 mt-1 block">
              {t('Must be 8+ characters with uppercase, lowercase, number, and special character.')}
            </span>

            {/* Password strength guidance */}
            <div className="mt-3">
              <PasswordStrengthIndicator password={password} showRequirements={true} />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">
              {t('Confirm Password')}
            </span>
            <input
              id="register-confirm-password"
              data-testid="register-confirm-password-input"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">
                {t('Date of Birth')}
              </span>
              <input
                id="register-dob"
                type="date"
                required
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Gender')}</span>
              <select
                id="register-gender"
                required
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors bg-white"
              >
                <option value="">{t('Select')}</option>
                <option value="female">{t('Female')}</option>
                <option value="male">{t('Male')}</option>
                <option value="nonbinary">{t('Non-binary')}</option>
                <option value="prefer_not_to_say">{t('Prefer not to say')}</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">
              {t('Profile Photo (optional)')}
            </span>
            <input
              id="register-photo"
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0] ?? null;
                setProfilePhoto(file);
                if (file) setPhotoPreview(URL.createObjectURL(file));
              }}
              className="w-full text-sm"
            />
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Profile preview"
                className="mt-2 w-24 h-24 object-cover rounded-full"
              />
            )}
          </label>

          {error && <p className="text-xs text-red-600">{t(error)}</p>}

          <button
            type="submit"
            data-testid="register-button"
            disabled={loading}
            className="w-full bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : t('Create Account')}
          </button>
        </form>

        <p className="mt-6 text-sm text-navy/60">
          {t('Already have an account?')}{' '}
          <Link to="/login" className="underline hover:text-navy">
            {t('Sign in')}
          </Link>
        </p>
      </div>
    </div>
  );
}
