import { useState } from 'react'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { Modal, Spinner } from '../../components/ui'
import { ORDER_STATUS } from '../../lib/format'
import type { OrderStatus } from '../../api/types'

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Xuất đơn hàng ra file CSV (mở bằng Excel) theo trạng thái + khoảng ngày */
export default function ExportOrdersButton({ status }: { status: OrderStatus | '' }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5)))
  const [to, setTo] = useState(iso(new Date()))
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const res = await api.get('/api/admin/orders/export', {
        params: { status: status || undefined, date_from: from || undefined, date_to: to || undefined },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = Object.assign(document.createElement('a'), { href: url, download: `don-hang_${from}_${to}.csv` })
      a.click()
      URL.revokeObjectURL(url)
      setOpen(false)
      toast.success('Đã tải file CSV')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn-outline" onClick={() => setOpen(true)}><Download size={16} /> Xuất CSV</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Xuất báo cáo đơn hàng">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Từ ngày</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label">Đến ngày</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <p className="text-sm text-coffee-500">
            Trạng thái: <b>{status ? ORDER_STATUS[status].label : 'Tất cả'}</b> (theo tab đang chọn). File mở được bằng Excel / Google Sheets.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setOpen(false)}>Hủy</button>
            <button className="btn-primary" onClick={download} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Download size={16} />} Tải xuống
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
