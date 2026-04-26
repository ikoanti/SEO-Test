export type AuditFindingStatus = 'pass' | 'warn' | 'fail' | 'info';
export type AuditFindingStatusFilter = Exclude<AuditFindingStatus, 'info'>;

export const AUDIT_FINDING_STATUS_FILTER_TO_STATUS: Record<
	AuditFindingStatusFilter,
	AuditFindingStatus
> = {
	pass: 'pass',
	warn: 'warn',
	fail: 'fail'
};
