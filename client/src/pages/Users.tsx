import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, addUser, updateUserRole, updateUserPages, updateUserPaymentMethods, deleteUser, changeUserPassword, toggleUserBan } from '../services/userService'
import { navItems } from '../config/roles'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { UserRole, UserRoleRecord } from '../types'
import api from '../lib/api'

const ROLES: UserRole[] = ['admin', 'staff', 'customer']

// Pages that admin can toggle for staff users
// All pages that admin can toggle for staff (excludes customer-only pages)
const STAFF_PAGES = navItems
  .filter((item) => !item.roles.every(r => r === 'customer'))
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
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null)
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [editProfileUserId, setEditProfileUserId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPlate, setEditPlate] = useState('')

  const editProfileMutation = useMutation({
    mutationFn: async ({ userId, full_name, phone, plate_number }: { userId: string; full_name: string; phone: string; plate_number: string }) => {
      await api.patch(`/api/users/profile/${userId}`, { full_name, phone, plate_number })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Profile updated')
      setEditProfileUserId(null)
    },
    onError: () => toast.error('Failed to update profile'),
  })

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

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => changeUserPassword(id, password),
    onSuccess: () => {
      toast.success(t('passwordChanged'))
      setPasswordUserId(null)
      setNewPasswordValue('')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error changing password'),
  })

  const banMutation = useMutation({
    mutationFn: ({ id, ban }: { id: string; ban: boolean }) => toggleUserBan(id, ban),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('userUpdated'))
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error updating account'),
  })

  const handleDelete = (user: UserRoleRecord) => {
    if (window.confirm(`${t('confirmDelete')} ${user.email}`)) {
      deleteMutation.mutate(user.id)
    }
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
                    <tr key={user.id} className={`transition-colors ${user.is_banned ? 'bg-red-50/50' : 'hover:bg-sheen-cream/50'}`}>
                      <td className="px-6 py-4" colSpan={3}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          {/* Email + status */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-body text-sm ${user.is_banned ? 'text-red-400 line-through' : 'text-sheen-black'}`}>{user.email}</p>
                              {user.is_banned && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-body font-medium bg-red-100 text-red-600">{t('disabled')}</span>
                              )}
                            </div>
                            {user.role === 'customer' && editProfileUserId !== user.id && (
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {user.full_name && (
                                  <span className="font-body text-xs text-sheen-black">{user.full_name}</span>
                                )}
                                {user.phone && (
                                  <span className="font-body text-xs text-sheen-muted">📞 {user.phone}</span>
                                )}
                                {user.plate_number ? (
                                  <span className="px-2 py-0.5 rounded bg-sheen-gold/20 text-sheen-black text-xs font-body font-semibold tracking-wider">
                                    🚗 {user.plate_number}
                                  </span>
                                ) : (
                                  <span className="font-body text-[10px] text-sheen-muted italic">No plate number</span>
                                )}
                                <button
                                  onClick={() => {
                                    setEditProfileUserId(user.id)
                                    setEditName(user.full_name || '')
                                    setEditPhone(user.phone || '')
                                    setEditPlate(user.plate_number || '')
                                  }}
                                  className="text-sheen-gold hover:text-sheen-brown text-[10px] font-body font-medium transition-colors"
                                >
                                  Edit
                                </button>
                              </div>
                            )}

                            {user.role === 'customer' && editProfileUserId === user.id && (
                              <div className="mt-2 p-3 bg-sheen-cream/60 rounded-lg space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div>
                                    <label className="block font-body text-[10px] text-sheen-muted mb-1">Full Name</label>
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={e => setEditName(e.target.value)}
                                      placeholder="Full name"
                                      className="w-full px-2 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-body text-[10px] text-sheen-muted mb-1">Phone</label>
                                    <input
                                      type="text"
                                      value={editPhone}
                                      onChange={e => setEditPhone(e.target.value)}
                                      placeholder="Phone number"
                                      className="w-full px-2 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-body text-[10px] text-sheen-muted mb-1">Plate Number</label>
                                    <input
                                      type="text"
                                      value={editPlate}
                                      onChange={e => setEditPlate(e.target.value.toUpperCase())}
                                      placeholder="e.g. A 12345"
                                      className="w-full px-2 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs focus:outline-none focus:ring-1 focus:ring-sheen-gold uppercase tracking-wider"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => editProfileMutation.mutate({ userId: user.user_id, full_name: editName, phone: editPhone, plate_number: editPlate })}
                                    disabled={editProfileMutation.isPending}
                                    className="px-3 py-1.5 rounded-lg bg-sheen-brown text-white font-body text-xs font-medium hover:bg-sheen-brown/90 disabled:opacity-50 transition-colors"
                                  >
                                    {editProfileMutation.isPending ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setEditProfileUserId(null)}
                                    className="px-3 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs text-sheen-muted hover:bg-sheen-cream transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                            {user.last_sign_in && (
                              <p className="font-body text-[10px] text-sheen-muted mt-0.5">
                                {t('lastLogin')}: {new Date(user.last_sign_in).toLocaleDateString()}
                              </p>
                            )}
                          </div>

                          {/* Role + Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
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
                              onClick={() => setPasswordUserId(passwordUserId === user.id ? null : user.id)}
                              className="text-sheen-muted hover:text-sheen-black text-xs font-body transition-colors"
                            >
                              {t('changePassword')}
                            </button>

                            <button
                              onClick={() => banMutation.mutate({ id: user.id, ban: !user.is_banned })}
                              disabled={banMutation.isPending}
                              className={`text-xs font-body font-medium transition-colors disabled:opacity-50 ${
                                user.is_banned
                                  ? 'text-green-600 hover:text-green-700'
                                  : 'text-orange-500 hover:text-orange-700'
                              }`}
                            >
                              {user.is_banned ? t('enableAccount') : t('disableAccount')}
                            </button>

                            <button
                              onClick={() => handleDelete(user)}
                              disabled={deleteMutation.isPending}
                              className="text-red-500 hover:text-red-700 text-xs font-body transition-colors disabled:opacity-50"
                            >
                              {t('delete')}
                            </button>
                          </div>
                        </div>

                        {/* Change password form */}
                        {passwordUserId === user.id && (
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type="text"
                              value={newPasswordValue}
                              onChange={(e) => setNewPasswordValue(e.target.value)}
                              placeholder={t('newPassword')}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                            />
                            <Button
                              size="sm"
                              onClick={() => passwordMutation.mutate({ id: user.id, password: newPasswordValue })}
                              disabled={!newPasswordValue.trim() || newPasswordValue.length < 6 || passwordMutation.isPending}
                            >
                              {passwordMutation.isPending ? t('saving') : t('save')}
                            </Button>
                            <button
                              onClick={() => { setPasswordUserId(null); setNewPasswordValue('') }}
                              className="text-xs font-body text-sheen-muted hover:text-sheen-black"
                            >
                              {t('cancel')}
                            </button>
                          </div>
                        )}

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
