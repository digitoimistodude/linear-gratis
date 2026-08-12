import { NextRequest, NextResponse } from 'next/server'
import { getLinearToken } from '@/lib/linear-token'
import { authorisePublicView } from '@/lib/public-view-auth'

interface RouteContext {
  params: Promise<{
    slug: string
  }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params

    const auth = await authorisePublicView(slug, request)
    if (!auth.ok) return auth.response
    const view = auth.view

    // Resolve which project to fetch updates for. Multi-project views pass
    // the chosen projectId via the query string; single-project views fall back
    // to the first configured project.
    const allowedProjectIds: string[] = view.project_ids?.length
      ? view.project_ids
      : view.project_id ? [view.project_id] : []

    if (allowedProjectIds.length === 0) {
      return NextResponse.json(
        { error: 'This view is not associated with a project' },
        { status: 400 }
      )
    }

    // Respect the view owner's choice to hide project updates entirely
    if (view.show_project_updates === false) {
      return NextResponse.json(
        { error: 'Project updates are hidden for this view' },
        { status: 403 }
      )
    }

    const requestedProjectId = request.nextUrl.searchParams.get('projectId')
    const projectId = requestedProjectId && allowedProjectIds.includes(requestedProjectId)
      ? requestedProjectId
      : allowedProjectIds[0]

    // Get the Linear token (workspace-shared, falling back to user's personal)
    const decryptedToken = await getLinearToken(view.user_id)
    if (!decryptedToken) {
      return NextResponse.json(
        { error: 'Unable to load data - Linear API token not found' },
        { status: 500 }
      )
    }


    // Fetch project updates from Linear
    const query = `
      query ProjectUpdates($projectId: String!) {
        project(id: $projectId) {
          id
          name
          progress
          state
          projectUpdates(first: 50) {
            nodes {
              id
              body
              createdAt
              editedAt
              health
              user {
                id
                name
                displayName
                avatarUrl
              }
              diffMarkdown
              isDiffHidden
              project {
                id
                name
                progress
                state
              }
            }
          }
        }
      }
    `

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': decryptedToken.trim()
      },
      body: JSON.stringify({
        query,
        variables: { projectId }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Linear API error response:', errorText)
      throw new Error(`Linear API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json() as {
      data?: {
        project: {
          id: string
          name: string
          progress: number
          state: string
          projectUpdates: {
            nodes: Array<{
              id: string
              body: string
              createdAt: string
              editedAt?: string
              health: string
              user: {
                id: string
                name: string
                displayName: string
                avatarUrl?: string
              }
              diffMarkdown?: string
              isDiffHidden: boolean
              project: {
                id: string
                name: string
                progress: number
                state: string
              }
            }>
          }
        }
      }
      errors?: Array<{ message: string }>
    }

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`)
    }

    if (!result.data) {
      throw new Error('No data returned from Linear API')
    }

    return NextResponse.json({
      success: true,
      project: result.data.project,
      updates: result.data.project.projectUpdates.nodes
    })

  } catch (error) {
    console.error('Project updates API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
