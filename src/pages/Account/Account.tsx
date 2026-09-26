import AccountLayout from './AccountLayout';
import ProfileForm from '../../components/ProfileForm';
import { useI18n } from '../../lib/i18n';
import { useSEO } from '../../hooks/useSEO';

export default function Account() {
  const { t } = useI18n();
  useSEO({
    title: 'Account Settings — NERVE',
    description: 'Manage your NERVE profile settings.',
    robots: 'noindex, nofollow',
  });
  return (
    <AccountLayout>
      <h2 className="nv-heading text-3xl mb-8">{t('Account Settings')}</h2>
      <ProfileForm />
    </AccountLayout>
  );
}
