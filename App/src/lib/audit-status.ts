export type AuditFindingStatus = 'pass' | 'warn' | 'info';
export type AuditFindingStatusFilter = AuditFindingStatus;

export const AUDIT_FINDING_STATUS_FILTER_TO_STATUS: Record<
	AuditFindingStatusFilter,
	AuditFindingStatus
> = {
	pass: 'pass',
	warn: 'warn',
	info: 'info'
};
