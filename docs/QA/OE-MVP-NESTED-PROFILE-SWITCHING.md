# OE MVP Nested Profile Switching

## Implementation

- The existing account dropdown now lists Metric Mind first, followed by expandable canonical client groups.
- Each client group uses its canonical Client Administrator identity and contains Client Overview plus its active canonical factories.
- Client and factory selections update the demo identity and access context as one recoverable operation.
- Existing non-Client-Admin operational personas remain available in a compact Factory Roles group.
- Search matches client names, administrator names, factory names, and operational persona names or roles.
- The existing header context selector remains the context-only switching control.

## Deferred consolidated acceptance

The following scenarios remain intentionally unexecuted for the final consolidated acceptance cycle:

1. Switch each Client Administrator to Client Overview and confirm the dashboard and Administration show only that client.
2. Switch each Client Administrator through every authorized factory and confirm the header, sidebar, Settings, Administration, user-seat counts, and records update together.
3. Configure different Red Tag entitlements for two factories and verify sidebar, direct-route, and command behavior without record deletion.
4. Search by administrator, client, and factory and confirm the correct parent client is revealed.
5. Switch between Client Administrator and Factory Roles personas and confirm identity, context, form remounting, and role permissions.
6. Attempt a revoked or mismatched membership and confirm the previous identity and context are restored.
7. Exercise browser Back/Forward after repeated identity and context selections.

Status: **IMPLEMENTATION COMPLETE — UNTESTED**
