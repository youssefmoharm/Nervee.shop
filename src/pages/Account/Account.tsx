import AccountLayout from './AccountLayout'
import ProfileForm from '../../components/ProfileForm'

export default function Account() {
  return (
    <AccountLayout>
      <h2 className="nv-heading text-3xl mb-8">Account Settings</h2>
      <ProfileForm />
    </AccountLayout>
  )
}
