import { motion } from 'framer-motion'
import { CalendarDays, MapPin } from 'lucide-react'

import PriorityBadge, { StatusBadge, statusAccent } from '@/components/PriorityBadge'
import { ComplaintThumb } from '@/utils/issueIcons'
import { formatDate } from '@/utils/helpers'

export default function ComplaintCard({ complaint, index = 0, children }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.05, 1) }}
      whileHover={{ y: -3, borderColor: 'rgba(125,180,255,0.35)' }}
      className="relative overflow-hidden rounded-2xl border border-white/14 bg-[rgba(26,26,29,0.75)] p-4 pl-5 shadow-[0_4px_18px_rgba(0,0,0,0.45)] sm:p-5 sm:pl-6"
    >
      {/* priority/status accent — the loudest signal on the card */}
      <span className={`absolute inset-y-0 left-0 w-1 ${statusAccent(complaint.status, complaint.priority_score)}`} />

      <div className="flex gap-4">
        <ComplaintThumb complaint={complaint} size={72} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label text-xs text-on-surface-variant">
              #{String(complaint.id).padStart(4, '0')}
            </span>
            <span className="text-sm font-medium text-on-surface">{complaint.issue_type}</span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge score={complaint.priority_score} className="ml-auto" />
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{complaint.description}</p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {complaint.ward}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatDate(complaint.created_at)}
            </span>
            <span>Urgency {complaint.urgency_level}</span>
          </div>
        </div>
      </div>

      {children && <div className="mt-4">{children}</div>}
    </motion.article>
  )
}
