import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { adminService } from '../../services/adminService'

export default function Payments() {
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<any | null>(null)

  const run = async () => {
    setRunning(true)
    const r = await adminService.runPaymentReconciliation()
    setReport(r)
    setRunning(false)
  }

  useEffect(() => {
    // nothing on mount
  }, [])

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="nv-heading text-4xl">Payments</h1>
        <div>
          <button onClick={run} className="px-4 py-2 bg-primary text-white rounded">{running ? 'Running...' : 'Run Reconciliation'}</button>
        </div>
      </div>

      {!report ? (
        <p className="text-navy/60">No report yet. Run reconciliation to generate.</p>
      ) : (
        <pre className="p-4 bg-mist/30 rounded text-xs overflow-auto">{JSON.stringify(report, null, 2)}</pre>
      )}
    </AdminLayout>
  )
}
