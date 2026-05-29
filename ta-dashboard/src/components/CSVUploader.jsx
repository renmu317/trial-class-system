import { useState, useRef } from 'react'
import { X, Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function CSVUploader({ taProfile, onSuccess, onClose }) {
  const [file, setFile] = useState(null)
  const [batchName, setBatchName] = useState('')
  const [expiresDays, setExpiresDays] = useState(30)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setFile(selectedFile)
    setError(null)

    // Read and preview file
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        const lines = content.trim().split('\n').slice(0, 6) // Preview first 5 rows + header
        setPreview(lines)
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      // Read file content
      const content = await file.text()

      // Get session for authorization
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-enrollment-csv`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            csv_content: content,
            batch_name: batchName || file.name.replace('.csv', ''),
            expires_days: expiresDays
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process CSV')
      }

      setResult(data)

    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Success state
  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Upload Successful!</h2>
            <p className="text-gray-600 mb-4">
              Created <strong>{result.total_students}</strong> enrollment links
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
              <div className="text-sm text-gray-600">
                <div>Batch: <strong>{result.batch_name}</strong></div>
                <div>Expires: {new Date(result.expires_at).toLocaleDateString()}</div>
              </div>
            </div>
            <button
              onClick={() => onSuccess(result)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Upload Enrollment CSV</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* File drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="text-blue-600" size={24} />
                <span className="font-medium text-gray-800">{file.name}</span>
              </div>
            ) : (
              <>
                <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-gray-600">Click to select a CSV file</p>
                <p className="text-xs text-gray-400 mt-1">
                  Required column: name or 姓名
                </p>
              </>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
              <p className="text-xs text-gray-500 mb-2">Preview:</p>
              <table className="text-xs w-full">
                <tbody>
                  {preview.map((line, i) => (
                    <tr key={i} className={i === 0 ? 'font-semibold' : ''}>
                      {line.split(',').map((cell, j) => (
                        <td key={j} className="px-2 py-1 border-b border-gray-200">
                          {cell.trim()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length >= 6 && (
                <p className="text-xs text-gray-400 mt-2">... and more rows</p>
              )}
            </div>
          )}

          {/* Batch name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Name (optional)
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder={file?.name.replace('.csv', '') || 'e.g., Spring 2026 Class'}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link expires in
            </label>
            <select
              value={expiresDays}
              onChange={(e) => setExpiresDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
