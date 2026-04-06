import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, addOrUpdateUser, updateUserRole, deleteUser } from '../services/userService'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { UserRole, UserRoleRecord } from '../types'

const ROLES: UserRole[] = ['admin', 'staff', 'customer']

export default function Users() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  // Form state for adding new user
  const [newEmail, setNewEmail] = useState('')
  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('staff')
  const [showAddForm, setShowAddForm] = useState(false)

  const addMutation = useMutation({
    mutationFn: () => addOrUpdateUser(newUserId.trim(), newEmail.trim(), newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('userAdded'))
      setNewEmail('')
      setNewUserId('')
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">User ID (UUID)</label>
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="Supabase user UUID"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('email')}</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@sheencafe.com"
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
            <div className="mt-4">
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!newUserId.trim() || !newEmail.trim() || addMutation.isPending}
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
                {users.map((user: UserRoleRecord) => (
                  <tr key={user.id} className="hover:bg-sheen-cream/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-body text-sm text-sheen-black">{user.email}</p>
                      <p className="font-body text-xs text-sheen-muted mt-0.5 truncate max-w-[200px]">{user.user_id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => updateMutation.mutate({ id: user.id, role: e.target.value as UserRole })}
                        className={`px-3 py-1 rounded-full text-xs font-body font-medium border-0 cursor-pointer ${roleBadgeColor[user.role]}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={deleteMutation.isPending}
                        className="text-red-500 hover:text-red-700 text-sm font-body transition-colors disabled:opacity-50"
                      >
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
