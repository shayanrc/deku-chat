# Ops test fixtures

Language-neutral test vectors for the branching operations, consumed by both
`packages/core/test/ops.test.ts` (vitest) and
`apps/fullstack/backend/tests/test_ops.py` (pytest).

Schema per file: `{ name, conversation, op, args, expected }` where `op` is one of
`forkBranch | combineBranches | spliceSummary | nextName`. For `nextName`,
`expected` is the resulting string; otherwise it is the full conversation after
the op, **normalized**:

- generated ids (crypto UUIDs) are replaced with `"NEW"`
- generated timestamps (values > 1e12, i.e. real epoch ms) are replaced with `0`

Input fixtures use short non-UUID ids and small timestamps so normalization only
touches fields the op created. Both test harnesses must apply the same
normalization before comparing.
