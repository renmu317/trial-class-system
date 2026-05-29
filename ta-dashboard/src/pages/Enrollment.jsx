import { useState, useEffect } from 'react'
import { ArrowLeft, Upload, Users, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import CSVUploader from '../components/CSVUploader'
import EnrollmentTable from '../components/EnrollmentTable'

export default function Enrollment({ taProfile, onBack }) {
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)

  // Load batches
  useEffect(() => {
    loadBatches()
  }, [])

  // Load enrollments when batch selected
  useEffect(() => {
    if (selectedBatch) {
      loadEnrollments(selectedBatch.id)
    }
  }, [selectedBatch])

  const loadBatches = async () => {
    const { data, error } = await supabase
      .from('enrollment_batches')
      .select('*')
      .eq('organization_id', taProfile.organization_id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setBatches(data)
      if (data.length > 0 && !selectedBatch) {
        setSelectedBatch(data[0])
      }
    }
    setLoading(false)
  }

  const loadEnrollments = async (batchId) => {
    const { data, error } = await supabase
      .from('student_enrollments')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setEnrollments(data)
    }
  }

  const handleUploadSuccess = (result) => {
    setShowUploader(false)
    loadBatches()
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700'
      case 'expired': return 'bg-gray-100 text-gray-600'
      case 'closed': return 'bg-red-100 text-red-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Enrollment Management</h1>
                <p className="text-sm text-gray-500">Upload CSV to create enrollment links</p>
              </div>
            </div>
            <button
              onClick={() => setShowUploader(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              <Upload size={18} />
              Upload CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Batch list */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users size={18} />
              Batches ({batches.length})
            </h2>

            {batches.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                No batches yet. Upload a CSV to get started.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {batches.map(batch => (
                  <button
                    key={batch.id}
                    onClick={() => setSelectedBatch(batch)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedBatch?.id === batch.id
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800 text-sm">
                        {batch.batch_name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(batch.status)}`}>
                        {batch.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {batch.enrolled_count}/{batch.total_students}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(batch.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Enrollment details */}
          <div className="md:col-span-2">
            {selectedBatch ? (
              <EnrollmentTable
                batch={selectedBatch}
                enrollments={enrollments}
                onRefresh={() => loadEnrollments(selectedBatch.id)}
              />
            ) : (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400">Select a batch to view enrollments</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* CSV Uploader Modal */}
      {showUploader && (
        <CSVUploader
          taProfile={taProfile}
          onSuccess={handleUploadSuccess}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  )
}
