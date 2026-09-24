import AccountLayout from './AccountLayout';
import ProfileForm from '../../components/ProfileForm';
import { useI18n } from '../../lib/i18n';

export default function Account() {
  const { t } = useI18n();
  return (
    <AccountLayout>
      <h2 className="nv-heading text-3xl mb-8">{t('Account Settings')}</h2>
      <ProfileForm />
    </AccountLayout>
  );
}
