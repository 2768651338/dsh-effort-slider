/** Keep our erased structural faces assignable from the pinned official DSH packages. */
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ModelDirectoryLike, SessionsLike } from '../src/client/effort/directory.ts'

type Compatible<Expected, Actual extends Expected> = Actual
export type DirectoryCompatibility = Compatible<ModelDirectoryLike, ModelDirectory>
export type SessionsCompatibility = Compatible<SessionsLike, ISessions>
