import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, addUser, updateUserRole, updateUserPages, updateUserPaymentMethods, deleteUser, getDefaultPaymentMethods, updateDefaultPaymentMethods } from '../services/userService'
import { navItems } from '../config/roles'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { UserRole, UserRoleRecord } from '../types'

const ROLES: UserRole[] = ['admin', 'staff', 'customer']

// Pages that admin can toggle for staff users
const STAFF_PAGES = navItems
  .filter((item) => item.roles.includes('staff'))
  .map((item) => ({ path: item.to, labelKey: item.labelKey }))

// Payment methods that admin can toggle
const ALL_PAYMENT_METHODS = [
  { id: 'cash', labelKey: 'cash' as const },
  { id: 'card', labelKey: 'card' as const },
]

export default function Users() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('staff')
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: () => addUser(newEmail.trim(), newRole, newPassword || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('userAdded'))
      setNewEmail('')
      setNewPassword('')
      setNewRole('staff')
      setShowAddForm(false)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error adding user'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('userUpdated'))
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error updating user'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('userDeleted'))
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error deleting user'),
  })

  const pagesMutation = useMutation({
    mutationFn: ({ id, allowed_pages }: { id: string; allowed_pages: string[] }) =>
      updateUserPages(id, allowed_pages),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('userUpdated'))
    },
    onError: () => toast.error('Error updating page access'),
  })

  const togglePage = (user: UserRoleRecord, pagePath: string) => {
    const current = user.allowed_pages ?? STAFF_PAGES.map((p) => p.path)
    const updated = current.includes(pagePath)
      ? current.filter((p) => p !== pagePath)
      : [...current, pagePath]
    pagesMutation.mutate({ id: user.id, allowed_pages: updated })
  }

  const paymentMethodsMutation = useMutation({
    mutationFn: ({ id, allowed_payment_methods }: { id: string; allowed_payment_methods: string[] }) =>
      updateUserPaymentMethods(id, allowed_payment_methods),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('userUpdated'))
    },
    onError: () => toast.error('Error updating payment methods'),
  })

  const togglePaymentMethod = (user: UserRoleRecord, methodId: string) => {
    const current = user.allowed_payment_methods ?? ALL_PAYMENT_METHODS.map((m) => m.id)
    const updated = current.includes(methodId)
      ? current.filter((m) => m !== methodId)
      : [...current, methodId]
    paymentMethodsMutation.mutate({ id: user.id, allowed_payment_methods: updated })
  }

  const handleDelete = (user: UserRoleRecord) => {
    if (window.confirm(`${t('confirmDelete')} ${user.email}`)) {
      deleteMutation.mutate(user.id)
    }
  }

  // Default customer payment methods
  const { data: defaultMethods } = useQuery({
    queryKey: ['default-payment-methods'],
    queryFn: getDefaultPaymentMethods,
  })

  const defaultMethodsMutation = useMutation({
    mutationFn: (methods: string[]) => updateDefaultPaymentMethods(methods),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['default-payment-methods'] })
      toast.success(t('userUpdated'))
    },
    onError: () => toast.error('Error updating default payment methods'),
  })

  const toggleDefaultMethod = (methodId: string) => {
    const current = defaultMethods ?? ALL_PAYMENT_METHODS.map((m) => m.id)
    const updated = current.includes(methodId)
      ? current.filter((m) => m !== methodId)
      : [...current, methodId]
    defaultMethodsMutation.mutate(updated)
  }

  const roleBadgeColor: Record<UserRole, string> = {
    admin: 'bg-red-100 text-red-700',
    staff: 'bg-blue-100 text-blue-700',
    customer: 'bg-green-100 text-green-700',
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('manageUsers')} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-sheen-black">{t('manageUsers')}</h1>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? t('cancel') : t('addUser')}
          </Button>
        </div>

        {/* Default Customer Payment Methods */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-sheen-gold/15 text-sheen-gold text-sm">
              {'\u{1F310}'}
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-sheen-black">{t('anyCustomer')}</h2>
              <p className="font-body text-xs text-sheen-muted">{t('anyCustomerDesc')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ALL_PAYMENT_METHODS.map((method) => {
              const current = defaultMethods ?? ALL_PAYMENT_METHODS.map((m) => m.id)
              const enabled = current.includes(method.id)
              return (
                <label
                  key={method.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    enabled
                      ? 'bg-sheen-gold/15 border border-sheen-gold/30'
                      : 'bg-sheen-cream border border-sheen-muted/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleDefaultMethod(method.id)}
                    className="h-4 w-4 accent-sheen-gold cursor-pointer"
                  />
                  <span className={`font-body text-sm ${enabled ? 'text-sheen-black font-medium' : 'text-sheen-muted'}`}>
                    {t(method.labelKey as any)}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Add User Form */}
        {showAddForm && (
          <div className="bg-sheen-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="font-display text-lg text-sheen-black mb-4">{t('addUser')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('email')}</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@sheencafe.com"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">
                  {t('password')}
                  <span className="text-sheen-muted/60 ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Default: Sheen@2026"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('role')}</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{t(r as any)}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-3 text-xs font-body text-sheen-muted">
              If the email already exists in Supabase Auth, the role will be assigned. Otherwise, a new account is created with the password above.
            </p>
            <div className="mt-4">
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!newEmail.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? t('saving') : t('addUser')}
              </Button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-sheen-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sheen-muted font-body">{t('loading')}</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sheen-muted font-body">No users found. Add your first user above.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-sheen-muted/20">
                  <th className="text-left px-6 py-3 font-body text-xs text-sheen-muted uppercase tracking-wider">{t('email')}</th>
                  <th className="text-left px-6 py-3 font-body text-xs text-sheen-muted uppercase tracking-wider">{t('role')}</th>
                  <th className="text-right px-6 py-3 font-body text-xs text-sheen-muted uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sheen-muted/10">
                {users.map((user: UserRoleRecord) => {
                  const isExpanded = expandedUserId === user.id
                  const userPages = user.allowed_pages ?? STAFF_PAGES.map((p) => p.path)

                  return (
                    <tr key={user.id} className="hover:bg-sheen-cream/50 transition-colors">
                      <td className="px-6 py-4" colSpan={3}>
                        <div className="flex items-center justify-between">
                          {/* Email */}
                          <p className="font-body text-sm text-sheen-black">{user.email}</p>

                          {/* Role + Actions */}
                          <div className="flex items-center gap-3">
                            <select
                              value={user.role}
                              onChange={(e) => updateMutation.mutate({ id: user.id, role: e.target.value as UserRole })}
                              className={`px-3 py-1 rounded-full text-xs font-body font-medium border-0 cursor-pointer ${roleBadgeColor[user.role]}`}
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                              ))}
                            </select>

                            {(user.role === 'staff' || user.role === 'customer') && (
                              <button
                                onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                                className="text-sheen-gold hover:text-sheen-brown text-xs font-body font-medium transition-colors"
                              >
                                {isExpanded ? t('collapse') : t('permissions')}
                              </button>
                            )}

                            <button
                              onClick={() => handleDelete(user)}
                              disabled={deleteMutation.isPending}
                              className="text-red-500 hover:text-red-700 text-sm font-body transition-colors disabled:opacity-50"
                            >
                              {t('delete')}
                            </button>
                          </div>
                        </div>

                        {/* Page access + Payment method toggles */}
                        {isExpanded && (user.role === 'staff' || user.role === 'customer') && (
                          <div className="mt-4 space-y-4">
                            {/* Page access — staff only */}
                            {user.role === 'staff' && (
                              <div className="p-4 bg-sheen-cream/50 rounded-lg">
                                <p className="font-body text-xs text-sheen-muted mb-3 uppercase tracking-wider">
                                  {t('pageAccess')}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {STAFF_PAGES.map((page) => {
                                    const enabled = userPages.includes(page.path)
                                    return (
                                      <label
                                        key={page.path}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                          enabled
                                            ? 'bg-sheen-gold/15 border border-sheen-gold/30'
                                            : 'bg-white border border-sheen-muted/20'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={enabled}
                                          onChange={() => togglePage(user, page.path)}
                                          className="h-4 w-4 accent-sheen-gold cursor-pointer"
                                        />
                                        <span className={`font-body text-sm ${enabled ? 'text-sheen-black font-medium' : 'text-sheen-muted'}`}>
                                          {t(page.labelKey)}
                                        </span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Payment methods — staff and customer */}
                            <div className="p-4 bg-sheen-cream/50 rounded-lg">
                              <p className="font-body text-xs text-sheen-muted mb-3 uppercase tracking-wider">
                                {t('paymentMethods')}
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {ALL_PAYMENT_METHODS.map((method) => {
                                  const userMethods = user.allowed_payment_methods ?? ALL_PAYMENT_METHODS.map((m) => m.id)
                                  const enabled = userMethods.includes(method.id)
                                  return (
                                    <label
                                      key={method.id}
                                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                        enabled
                                          ? 'bg-sheen-gold/15 border border-sheen-gold/30'
                                          : 'bg-white border border-sheen-muted/20'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={enabled}
                                        onChange={() => togglePaymentMethod(user, method.id)}
                                        className="h-4 w-4 accent-sheen-gold cursor-pointer"
                                      />
                                      <span className={`font-body text-sm ${enabled ? 'text-sheen-black font-medium' : 'text-sheen-muted'}`}>
                                        {t(method.labelKey as any)}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
