# Firestore Security Analysis

This note documents the Firestore paths and access patterns used to draft the
prototype rules.

## Paths

All app data is stored below:

- `artifacts/{appId}/public/data/workspaces/{workspaceId}`
- `artifacts/{appId}/public/data/tasks/{taskId}`
- `artifacts/{appId}/public/data/members/{memberId}`
- `artifacts/{appId}/public/data/departments/{departmentId}`
- `artifacts/{appId}/public/data/projects/{projectId}`

## Query Patterns

- Workspaces owned by the current user:
  `where('ownerId', '==', user.uid)`
- Workspaces shared with the current user's normalized email:
  `where('members', 'array-contains', normalizedEmail)`
- Workspace-scoped data:
  `where('workspaceId', '==', activeWorkspaceId)`

## Authorization Model

- A signed-in user can read a workspace if:
  - they own it by `ownerId`, or
  - their normalized email is in `members`, or
  - the workspace is the built-in `default` workspace.
- Only the workspace owner can update or delete the workspace document.
- Workspace members can read and write workspace-scoped task, member,
  department, and project documents.

## Known Limitations

- Email membership depends on Firebase Auth email claims and normalized email
  values stored in `members`.
- The built-in `default` workspace is accessible to any signed-in user.
- These rules are a prototype and should be reviewed before broad production use.
