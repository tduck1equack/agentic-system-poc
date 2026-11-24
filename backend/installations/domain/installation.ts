import { DomainError, requireValue } from '../../shared/domain/errors';
export interface InstallationState {
  id: string; userId: string; pluginId: string; versionId: string;
  credential: string; enabled: boolean; status: string;
}
export class Installation {
  private constructor(private readonly state: InstallationState) {}
  static install(id: string, userId: string, pluginId: string, versionId: string, credential: string) {
    return new Installation({ id, userId, pluginId, versionId, credential, enabled: true, status: 'connected' });
  }
  static restore(state: InstallationState) { return new Installation({ ...state }); }
  ownedBy(userId: string) {
    if (this.state.userId !== userId) throw new DomainError('not_found', 'Not found');
    return this;
  }
  requireEnabled() { requireValue(this.state.enabled, 'Installation disabled'); return this; }
  toggle(enabled: boolean) { return Installation.restore({ ...this.state, enabled }); }
  reconnect(credential: string) { return Installation.restore({ ...this.state, credential, status: 'connected' }); }
  markStatus(status: 'connected' | 'disconnected' | 'schema_drift') { return Installation.restore({ ...this.state, status }); }
  snapshot() { return { ...this.state }; }
  publicView() { const { credential: _, ...view } = this.state; return view; }
}
/** Per-user capacity policy, evaluated under the repository's user lock. */
export function assertCapacity(activeToolCounts: number[], candidateToolCount: number) {
  requireValue(activeToolCounts.length < 5, 'Maximum five enabled plugins');
  requireValue(activeToolCounts.reduce((n, count) => n + count, candidateToolCount) <= 50, 'Maximum fifty tools');
}
