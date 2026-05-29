import { useState } from 'react'
import { Copy, Check, Download, RefreshCw, ExternalLink } from 'lucide-react'

const STUDENT_APP_URL = import.meta.env.VITE_STUDENT_APP_URL || 'https://student-app-one-mu.vercel.app'

export default function EnrollmentTable({ batch, enrollments, onRefresh }) {
  const [copiedId, setCopiedId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const getEnrollmentUrl = (token) => {
    return `${STUDENT_APP_URL}/enroll/${token}`
  }

  const copyLink = async (enrollment) => {
    const url = getEnrollmentUrl(enrollment.enrollment_token)
    await navigator.clipboard.writeText(url)
    setCopiedId(enrollment.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyAllLinks = async () => {
    const links = enrollments.map(e =>
      `${e.student_name}: ${getEnrollmentUrl(e.enrollment_token)}`
    ).join('\n')
    await navigator.clipboard.writeText(links)
    alert('All links copied to clipboard!')
  }

  const exportCSV = () => {
    const header = 'Student Name,Phone,Grade,Status,Enrollment Link,Shortcode\n'
    const rows = enrollments.map(e =>
      `"${e.student_name}","${e.parent_phone || ''}","${e.grade || ''}","${e.status}","${getEnrollmentUrl(e.enrollment_token)}","${e.shortcode || ''}"`
    ).join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${batch.batch_name}-enrollments.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">Pending</span>
      case 'enrolled':
        return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">Enrolled</span>
      case 'expired':
        return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">Expired</span>
      default:
        return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">{status}</span>
    }
  }

  const pendingCount = enrollments.filter(e => e.status === 'pending').length
  const enrolledCount = enrollments.filter(e => e.status === 'enrolled').length

  return (
    <div className="bg-white rounded-xl shadow">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">{batch.batch_name}</h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>{enrolledCount}/{enrollments.length} enrolled</span>
            <span>{pendingCount} pending</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={copyAllLinks}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            <Copy size={14} />
            Copy All
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Shortcode</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enrollments.map(enrollment => (
              <tr key={enrollment.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{enrollment.student_name}</div>
                  {enrollment.grade && (
                    <div className="text-xs text-gray-500">{enrollment.grade}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {enrollment.parent_phone || enrollment.parent_phone_verified || '-'}
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(enrollment.status)}
                </td>
                <td className="px-4 py-3">
                  {enrollment.shortcode ? (
                    <code className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm font-mono">
                      {enrollment.shortcode}
                    </code>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {enrollment.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyLink(enrollment)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Copy link"
                      >
                        {copiedId === enrollment.id ? (
                          <Check size={16} className="text-green-600" />
                        ) : (
                          <Copy size={16} className="text-gray-500" />
                        )}
                      </button>
                      <a
                        href={getEnrollmentUrl(enrollment.enrollment_token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Open link"
                      >
                        <ExternalLink size={16} className="text-gray-500" />
                      </a>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {enrollments.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          No enrollments in this batch
        </div>
      )}
    </div>
  )
}
