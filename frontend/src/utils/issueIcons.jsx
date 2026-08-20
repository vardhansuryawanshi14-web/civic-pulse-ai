import { CircleDot, Droplets, LampFloor, Trash2, TriangleAlert } from 'lucide-react'

import { photoUrl } from '@/api/axios'

/** Category-specific icons — never a generic document placeholder. */
const ICONS = {
  Pothole: CircleDot,
  Garbage: Trash2,
  'Broken Light': LampFloor,
  'Water Leakage': Droplets,
  Other: TriangleAlert,
}

export function issueIcon(issueType) {
  return ICONS[issueType] || TriangleAlert
}

/** Photo thumbnail with a category-icon fallback when no photo was uploaded. */
export function ComplaintThumb({ complaint, size = 72, className = '' }) {
  const Icon = issueIcon(complaint.issue_type)
  const style = { width: size, height: size }

  if (complaint.has_photo) {
    return (
      <img
        src={photoUrl(complaint.id)}
        alt={`${complaint.issue_type} reported in ${complaint.ward}`}
        loading="lazy"
        style={style}
        className={`shrink-0 rounded-lg border border-border object-cover ${className}`}
      />
    )
  }

  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-container text-on-surface-variant ${className}`}
    >
      <Icon className="size-6" />
    </span>
  )
}
