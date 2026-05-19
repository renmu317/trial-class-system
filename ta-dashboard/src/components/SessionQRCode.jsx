import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'

export default function SessionQRCode({ sessionId, joinCode }) {
  const [copied, setCopied] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const studentAppUrl = import.meta.env.VITE_STUDENT_APP_URL || 'http://localhost:5173'
  const sessionUrl = `${studentAppUrl}/?code=${joinCode || sessionId}`

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Student Join</h3>

      {/* Join Code - Large display for laptop users */}
      {joinCode && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Monitor size={18} />
            <span className="text-sm font-medium">For Laptop Users</span>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Go to</div>
            <div className="font-mono text-lg text-gray-700 mb-2">
              {studentAppUrl.replace('http://', '')}
            </div>
            <div className="text-xs text-gray-500 mb-1">Enter code</div>
            <div className="text-5xl font-bold text-blue-600 tracking-wider mb-3">
              {joinCode}
            </div>
            <button
              onClick={handleCopyCode}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${copiedCode
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                }`}
            >
              {copiedCode ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>
      )}

      {/* QR Code - For phone users */}
      <div className="p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2 text-gray-600 mb-3">
          <Smartphone size={18} />
          <span className="text-sm font-medium">For Phone Users</span>
        </div>
        <div className="flex justify-center mb-3">
          <QRCodeSVG value={sessionUrl} size={150} />
        </div>
      </div>

      {/* Full URL copy */}
      <div className="mt-4">
        <div className="text-xs text-gray-500 mb-2 break-all bg-gray-50 p-2 rounded">
          {sessionUrl}
        </div>
        <button
          onClick={handleCopyUrl}
          className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm
            ${copied
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
        >
          {copied ? (
            <>
              <Check size={16} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={16} />
              Copy Full URL
            </>
          )}
        </button>
      </div>
    </div>
  )
}
