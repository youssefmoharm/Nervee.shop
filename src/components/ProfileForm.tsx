import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Calendar, MapPin, Phone, User, Mail, Lock } from 'lucide-react';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { calculatePasswordStrength } from '../lib/passwordValidation';
import { useI18n } from '../lib/i18n';

interface ProfileData {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  city: string;
  bio: string;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfileForm() {
  const { t } = useI18n();
  const { user, updatePassword } = useAuth();
  const { showToast } = useToast();

  // Profile state
  const [profile, setProfile] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    city: '',
    bio: '',
  });

  // Password change state
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Load profile data
  useEffect(() => {
    if (!user) return;

    supabase
      .from('customers')
      .select('first_name, last_name, phone, date_of_birth, gender, city, bio')
      .eq('id', user.id)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (data) {
            setProfile({
              firstName: data.first_name ?? '',
              lastName: data.last_name ?? '',
              phone: data.phone ?? '',
              dateOfBirth: data.date_of_birth ?? '',
              gender: data.gender ?? '',
              city: data.city ?? '',
              bio: data.bio ?? '',
            });
          }
          setLoading(false);
        },
        () => setLoading(false),
      );
  }, [user]);

  // Save profile changes
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from('customers')
      .update({
        first_name: profile.firstName,
        last_name: profile.lastName,
        phone: profile.phone,
        date_of_birth: profile.dateOfBirth || null,
        gender: profile.gender || null,
        city: profile.city || null,
        bio: profile.bio || null,
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      showToast(t('Failed to update profile'), 'error');
    } else {
      showToast(t('Profile updated successfully'), 'success');
    }
  };

  // Change password
  const changePassword = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast(t('Passwords do not match'), 'error');
      return;
    }

    const strength = calculatePasswordStrength(passwordData.newPassword);
    if (!strength.isValid) {
      showToast(t('Password does not meet requirements'), 'error');
      return;
    }

    setChangingPassword(true);

    // First verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: passwordData.currentPassword,
    });

    if (signInError) {
      setChangingPassword(false);
      showToast(t('Current password is incorrect'), 'error');
      return;
    }

    // Update password
    const { error } = await updatePassword(passwordData.newPassword);
    setChangingPassword(false);

    if (error) {
      showToast(error, 'error');
    } else {
      showToast(t('Password updated successfully'), 'success');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-mist w-32" />
        <div className="space-y-4">
          <div className="h-12 bg-mist w-full" />
          <div className="h-12 bg-mist w-full" />
          <div className="h-12 bg-mist w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Tab Navigation */}
      <div className="flex mb-8 border-b border-navy/10">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-1 mr-8 transition-colors ${
            activeTab === 'profile'
              ? 'border-b-2 border-navy text-navy font-medium'
              : 'text-navy/60 hover:text-navy'
          }`}
        >
          <div className="flex items-center gap-2">
            <User size={16} />
            {t('Profile Information')}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`pb-3 px-1 transition-colors ${
            activeTab === 'password'
              ? 'border-b-2 border-navy text-navy font-medium'
              : 'text-navy/60 hover:text-navy'
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock size={16} />
            {t('Change Password')}
          </div>
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <form onSubmit={saveProfile} className="space-y-6">
          <h3 className="nv-heading text-xl mb-4">{t('Personal Information')}</h3>

          {/* Email (readonly) */}
          <div>
            <label
              htmlFor="profile-email"
              className="flex items-center gap-2 text-sm font-medium text-navy/60 mb-2"
            >
              <Mail size={14} />
              {t('Email Address')}
            </label>
            <input
              id="profile-email"
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full border border-navy/10 bg-mist/60 px-4 py-3 text-sm text-navy/50"
            />
            <p className="text-xs text-navy/40 mt-1">{t('Email cannot be changed')}</p>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="profile-firstName"
                className="flex items-center gap-2 text-sm font-medium text-navy/60 mb-2"
              >
                <User size={14} />
                {t('First Name')}
              </label>
              <input
                id="profile-firstName"
                type="text"
                value={profile.firstName}
                onChange={e => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
                placeholder={t('Enter your first name')}
              />
            </div>
            <div>
              <label
                htmlFor="profile-lastName"
                className="flex items-center gap-2 text-sm font-medium text-navy/60 mb-2"
              >
                <User size={14} />
                {t('Last Name')}
              </label>
              <input
                id="profile-lastName"
                type="text"
                value={profile.lastName}
                onChange={e => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
                placeholder={t('Enter your last name')}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="profile-phone"
              className="flex items-center gap-2 text-sm font-medium text-navy/60 mb-2"
            >
              <Phone size={14} />
              {t('Phone Number')}
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={profile.phone}
              onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              placeholder="+20 1xx xxx xxxx"
            />
          </div>

          {/* Date of Birth & Gender */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="profile-dob"
                className="flex items-center gap-2 text-sm font-medium text-navy/60 mb-2"
              >
                <Calendar size={14} />
                {t('Date of Birth')}
              </label>
              <input
                id="profile-dob"
                type="date"
                value={profile.dateOfBirth}
                onChange={e => setProfile(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="profile-gender"
                className="text-sm font-medium text-navy/60 mb-2 block"
              >
                {t('Gender')}
              </label>
              <select
                id="profile-gender"
                value={profile.gender}
                onChange={e => setProfile(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors bg-white"
              >
                <option value="">{t('Select gender')}</option>
                <option value="male">{t('Male')}</option>
                <option value="female">{t('Female')}</option>
                <option value="other">{t('Other')}</option>
                <option value="prefer-not-to-say">{t('Prefer not to say')}</option>
              </select>
            </div>
          </div>

          {/* City */}
          <div>
            <label
              htmlFor="profile-city"
              className="flex items-center gap-2 text-sm font-medium text-navy/60 mb-2"
            >
              <MapPin size={14} />
              {t('City')}
            </label>
            <input
              id="profile-city"
              type="text"
              value={profile.city}
              onChange={e => setProfile(prev => ({ ...prev, city: e.target.value }))}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
              placeholder="Cairo, Alexandria, etc."
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="profile-bio" className="text-sm font-medium text-navy/60 mb-2 block">
              {t('About Me')}
            </label>
            <textarea
              id="profile-bio"
              value={profile.bio}
              onChange={e => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              rows={4}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors resize-none"
              placeholder={t('Tell us a bit about yourself...')}
              maxLength={500}
            />
            <p className="text-xs text-navy/40 mt-1">
              {profile.bio.length}/500 {t('characters')}
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60"
          >
            {saving ? t('Saving...') : t('Save Changes')}
          </button>
        </form>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <form onSubmit={changePassword} className="space-y-6">
          <h3 className="nv-heading text-xl mb-4">{t('Change Password')}</h3>

          {/* Current Password */}
          <div>
            <label
              htmlFor="current-password"
              className="text-sm font-medium text-navy/60 mb-2 block"
            >
              {t('Current Password')}
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={e =>
                  setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))
                }
                className="w-full border border-navy/20 px-4 py-3 pr-12 text-sm focus:outline-none focus:border-navy transition-colors"
                placeholder={t('Enter your current password')}
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy"
              >
                {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="new-password" className="text-sm font-medium text-navy/60 mb-2 block">
              {t('New Password')}
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={e => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full border border-navy/20 px-4 py-3 pr-12 text-sm focus:outline-none focus:border-navy transition-colors"
                placeholder={t('Enter a strong password')}
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy"
              >
                {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {passwordData.newPassword && (
              <div className="mt-3">
                <PasswordStrengthIndicator password={passwordData.newPassword} />
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="text-sm font-medium text-navy/60 mb-2 block"
            >
              {t('Confirm New Password')}
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={e =>
                  setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))
                }
                className={`w-full border px-4 py-3 pr-12 text-sm focus:outline-none transition-colors ${
                  passwordData.confirmPassword &&
                  passwordData.newPassword !== passwordData.confirmPassword
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-navy/20 focus:border-navy'
                }`}
                placeholder={t('Confirm your new password')}
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy"
              >
                {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordData.confirmPassword &&
              passwordData.newPassword !== passwordData.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">{t('Passwords do not match')}</p>
              )}
          </div>

          <button
            type="submit"
            disabled={
              changingPassword ||
              !passwordData.currentPassword ||
              !passwordData.newPassword ||
              !passwordData.confirmPassword ||
              passwordData.newPassword !== passwordData.confirmPassword
            }
            className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60"
          >
            {changingPassword ? t('Changing Password...') : t('Change Password')}
          </button>
        </form>
      )}
    </div>
  );
}
