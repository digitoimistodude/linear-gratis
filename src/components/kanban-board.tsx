'use client'

import { LinearIssue } from '@/app/api/linear/issues/route'
import { FilterState } from '@/components/filter-dropdown'
import { PriorityIcon, EstimateIcon, MilestoneIcon } from '@/components/priority-icon'
import { UserAvatar } from '@/components/user-avatar'
import { toast } from 'sonner'

// Shared Tailwind classes for the small metadata badges on a kanban card
// (priority, estimate, label). Using theme tokens so the badges adapt to
// whatever colour scheme the branding has set.
const CARD_BADGE_CLASS =
  'flex items-center gap-1 h-[22px] px-1 rounded border border-border bg-accent/40 text-muted-foreground text-xs font-medium overflow-hidden flex-shrink-0 max-w-[134px] transition-colors duration-150 hover:text-foreground'

interface KanbanBoardProps {
  issues: LinearIssue[]
  showAssignees?: boolean
  showLabels?: boolean
  showPriorities?: boolean
  showDescriptions?: boolean
  showSubIssues?: boolean
  className?: string
  filters?: FilterState
  onIssueClick?: (issueId: string) => void
}

const getStateIcon = (stateType: string, color: string) => {
  const strokeColor = color || '#9ca3af'

  if (stateType === 'completed') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" fill={strokeColor} stroke={strokeColor} strokeWidth="1.5"></circle>
        <path d="M4.5 7l2 2 3-3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"></path>
      </svg>
    )
  }

  if (stateType === 'started') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="3.14 0" strokeDashoffset="-0.7"></circle>
        <circle className="progress" cx="7" cy="7" r="2" fill="none" stroke={strokeColor} strokeWidth="4" strokeDasharray="12.189379495928398 24.378758991856795" strokeDashoffset="6.094689747964199" transform="rotate(-90 7 7)"></circle>
      </svg>
    )
  }

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="3.14 0" strokeDashoffset="-0.7"></circle>
      <circle className="progress" cx="7" cy="7" r="2" fill="none" stroke={strokeColor} strokeWidth="4" strokeDasharray="12.189379495928398 24.378758991856795" strokeDashoffset="12.189379495928398" transform="rotate(-90 7 7)"></circle>
    </svg>
  )
}

export function KanbanBoard({
  issues,
  showAssignees = true,
  showLabels = true,
  showPriorities = true,
  showSubIssues = true,
  className = '',
  filters,
  onIssueClick
}: KanbanBoardProps) {
  // Filter out sub-issues if disabled
  const visibleIssues = showSubIssues ? issues : issues.filter(issue => !issue.parent)

  // Filter issues based on provided filters
  const filteredIssues = filters ? visibleIssues.filter(issue => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      if (!issue.title.toLowerCase().includes(searchLower) &&
          !issue.identifier.toLowerCase().includes(searchLower) &&
          !(issue.description?.toLowerCase().includes(searchLower))) {
        return false
      }
    }

    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(issue.state.name)) {
      return false
    }

    // Assignee filter
    if (filters.assignees.length > 0) {
      if (!issue.assignee || !filters.assignees.includes(issue.assignee.id)) {
        return false
      }
    }

    // Priority filter
    if (filters.priorities.length > 0 && !filters.priorities.includes(issue.priority)) {
      return false
    }

    // Labels filter
    if (filters.labels.length > 0) {
      const hasMatchingLabel = issue.labels.some(label => filters.labels.includes(label.id))
      if (!hasMatchingLabel) {
        return false
      }
    }

    // Project filter - only include issues whose project is in the selected list
    if (filters.projects.length > 0) {
      if (!issue.project || !filters.projects.includes(issue.project.id)) {
        return false
      }
    }

    // Milestone filter - only include issues whose milestone is selected
    if (filters.milestones.length > 0) {
      if (!issue.milestone || !filters.milestones.includes(issue.milestone.id)) {
        return false
      }
    }

    // Creator filter (placeholder - would need additional API data)
    if (filters.creators.length > 0) {
      // For now, we'll skip this filter since we don't have creator data
      // In a real implementation, you'd filter by issue.creator.id
    }

    return true
  }) : visibleIssues

  // Group filtered issues by their state
  const groupedIssues = filteredIssues.reduce((acc, issue) => {
    const stateName = issue.state.name
    if (!acc[stateName]) {
      acc[stateName] = {
        issues: [],
        color: issue.state.color,
        type: issue.state.type
      }
    }
    acc[stateName].issues.push(issue)
    return acc
  }, {} as Record<string, { issues: LinearIssue[], color: string, type: string }>)

  // Sort columns by workflow order: backlog -> to do -> in progress -> done
  const stateTypeOrder: Record<string, number> = {
    'backlog': 0,
    'unstarted': 1,
    'started': 2,
    'completed': 3,
    'canceled': 4
  }

  const columns = Object.keys(groupedIssues).sort((a, b) => {
    const typeA = groupedIssues[a].type
    const typeB = groupedIssues[b].type
    const orderA = stateTypeOrder[typeA] ?? 999
    const orderB = stateTypeOrder[typeB] ?? 999
    return orderA - orderB
  })

  if (filteredIssues.length === 0 && issues.length > 0) {
    return (
      <div className="text-center py-20">
        <div className="text-muted-foreground">
          <div className="text-lg font-medium mb-2">No issues match your filters</div>
          <div className="text-sm">Try adjusting your filter criteria to see more results.</div>
        </div>
      </div>
    )
  }

  if (issues.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-muted-foreground">
          <div className="text-lg font-medium mb-2">No issues found</div>
          <div className="text-sm">This view doesn&apos;t contain any issues yet.</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Linear-style board container */}
      <div className="flex gap-1 overflow-x-auto pb-4 px-1">
        {columns.map((columnName) => {
          const column = groupedIssues[columnName]
          const columnColor = column.color || '#9ca3af'

          return (
            <div key={columnName} className="flex-shrink-0 w-80 sm:w-[356px] group">
              {/* Column Header - matching Linear's exact structure */}
              <div className="flex flex-row h-12 w-full pl-1" style={{ paddingLeft: '4px' }}>
                <div className="w-full" style={{ width: '348px' }}>
                  <div className="flex items-center justify-between p-3 mb-2">
                    <div className="flex items-center gap-2">
                      {getStateIcon(column.type, columnColor)}
                      <span className="text-sm font-medium text-foreground tracking-tight">
                        {columnName}
                      </span>
                      <div className="flex items-center justify-center px-2 py-0.5 bg-muted/60 rounded-full">
                        <span className="text-xs font-medium text-muted-foreground">
                          {column.issues.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Issues Column - matching Linear's exact structure */}
              <div className="flex flex-row w-full pl-1" style={{ paddingLeft: '4px' }}>
                <div className="w-full" style={{ width: '348px' }}>
                  <div className="space-y-2 px-1">
                    {column.issues.map((issue) => (
                      <div key={issue.id} className="linear-hover-lift">
                          {/* Issue Card - matching Linear's exact structure */}
                          <button
                            onClick={() => onIssueClick?.(issue.id)}
                            className="w-full bg-card border border-border/40 rounded-md hover:border-border/60 hover:shadow-sm transition-all duration-200 group cursor-pointer text-left"
                          >
                            <div className="relative p-3">
                              {/* Top row: Issue ID, Status Icon, and Assignee */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigator.clipboard.writeText(issue.identifier)
                                      toast.success(`Copied ${issue.identifier}`)
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        navigator.clipboard.writeText(issue.identifier)
                                        toast.success(`Copied ${issue.identifier}`)
                                      }
                                    }}
                                    className="text-xs font-mono text-muted-foreground/80 tracking-wider font-semibold hover:text-foreground transition-colors cursor-pointer"
                                    aria-label={`Copy ${issue.identifier}`}
                                    title="Click to copy"
                                  >
                                    {issue.identifier}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {getStateIcon(issue.state.type, issue.state.color)}
                                  </div>
                                </div>

                                {/* Assignee in top right */}
                                {showAssignees && issue.assignee && (
                                  <div className="flex-shrink-0">
                                    <UserAvatar name={issue.assignee.name} avatarUrl={issue.assignee.avatarUrl} />
                                  </div>
                                )}
                              </div>

                              {/* Parent indicator for sub-issues */}
                              {issue.parent && (
                                <div className="flex items-center gap-1 mb-1">
                                  <svg className="w-3 h-3 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 3v6.5a2.5 2.5 0 0 0 2.5 2.5H12" />
                                    <path d="M9.5 9.5L12 12l-2.5 2.5" />
                                  </svg>
                                  <span className="text-xs text-muted-foreground truncate">{issue.parent.identifier}</span>
                                </div>
                              )}
                              {/* Issue title */}
                              <div className="mb-3">
                                <h4 className="text-sm font-medium text-foreground leading-tight tracking-tight line-clamp-2">
                                  {issue.title}
                                </h4>
                              </div>

                              {/* Bottom badges row */}
                              <div className="flex items-center gap-1 flex-wrap">

                                {/* Priority badge */}
                                {showPriorities && (
                                  <div className={CARD_BADGE_CLASS}>
                                    <PriorityIcon
                                      priority={issue.priority}
                                      priorityLabel={issue.priorityLabel}
                                    />
                                  </div>
                                )}

                                {/* Estimate badge */}
                                {issue.estimate != null && issue.estimate > 0 && (
                                  <div className={CARD_BADGE_CLASS}>
                                    <EstimateIcon />
                                    <span>{issue.estimate}</span>
                                  </div>
                                )}

                                {/* Milestone badge */}
                                {issue.milestone && (
                                  <div className={CARD_BADGE_CLASS}>
                                    <MilestoneIcon />
                                    <span className="truncate">{issue.milestone.name}</span>
                                  </div>
                                )}

                                {/* Label badges */}
                                {showLabels && issue.labels.map((label) => (
                                  <div key={label.id} className={CARD_BADGE_CLASS}>
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: label.color }}
                                    />
                                    <span>{label.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </button>
                      </div>
                    ))}

                    {column.issues.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground/60">
                        <div className="text-sm">No issues</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}