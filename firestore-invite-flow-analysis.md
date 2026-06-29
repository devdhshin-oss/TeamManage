# Firestore Invite Flow Analysis

## Paths

- `artifacts/{appId}/public/data/workspaces/{workspaceId}`
- `artifacts/{appId}/public/data/workspaceAccess/{workspaceId}_{email}`
- Workspace-scoped collections:
  - `tasks`
  - `members`
  - `departments`
  - `projects`

## Query Patterns

- Owner workspaces: `where('ownerId', '==', user.uid)`
- Invite records for the signed-in account: `where('email', '==', normalizedEmail)`
- Workspace-scoped data: `where('workspaceId', '==', activeWorkspaceId)`

## Invite Authorization Model

- Creating an invite writes a `workspaceAccess` document with `status: 'pending'`.
- Pending invites do not add the invited email to the workspace `members` list.
- Workspace access is granted by ownership, existing workspace membership, or an accepted `workspaceAccess` document.
- Invite notifications are loaded when the signed-in user is on the workspace selection screen.
- Accepting a legacy invite also attempts to create a canonical `{workspaceId}_{normalizedEmail}` access document so Security Rules can evaluate accepted access consistently.
- Accepted workspace loading tolerates individual workspace read failures so one stale/invalid invite does not hide the rest of the user's workspaces.

## Notes

- Standard Firestore queries are used because the app needs Firebase Auth-aware reads and simple document operations in the existing Web SDK flow.
- Existing legacy invite documents that used URL-encoded email IDs are migrated opportunistically after acceptance by creating a canonical access document verified against the accepted legacy document.
