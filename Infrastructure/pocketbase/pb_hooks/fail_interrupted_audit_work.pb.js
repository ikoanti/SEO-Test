onBootstrap((e) => {
  e.next();

  try {
    const result = failInterruptedAuditWork();
    console.log(
      `[startup] PocketBase failed interrupted audit work: ${result.audits} audit(s), ${result.workflows} workflow(s), ${result.runs} run(s).`,
    );
  } catch (error) {
    console.warn(
      `[startup] PocketBase failed to reconcile interrupted audit work: ${errorMessage(error)}`,
    );
  }
});

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function timestamp() {
  return new Date().toISOString();
}

function appendLog(existing, line) {
  const value = String(existing || "").trim();
  return value ? `${value}\n${line}` : line;
}

function interruptedRecords(collectionName) {
  try {
    return $app.findRecordsByFilter(
      collectionName,
      'status = "queued" || status = "running"',
      "",
      0,
      0,
    );
  } catch {
    return [];
  }
}

function saveRecords(records, apply) {
  let count = 0;

  records.forEach((record) => {
    try {
      apply(record);
      $app.save(record);
      count += 1;
    } catch (error) {
      console.warn(
        `[startup] PocketBase skipped interrupted record ${record.id}: ${errorMessage(error)}`,
      );
    }
  });

  return count;
}

function failInterruptedAuditWork() {
  const failedAt = timestamp();
  const message = "Interrupted by service restart.";
  const logLine = `[${failedAt}] ${message}`;

  const audits = interruptedRecords("audits");
  const workflows = interruptedRecords("workflows");
  const runs = interruptedRecords("runs");

  const auditCount = saveRecords(audits, (audit) => {
    audit.set("status", "failed");
    audit.set("updated_at", failedAt);
  });

  const workflowCount = saveRecords(workflows, (workflow) => {
    workflow.set("status", "failed");
    workflow.set("completed_at", failedAt);
    workflow.set("error_message", message);
    workflow.set("run_log", appendLog(workflow.getString("run_log"), logLine));
  });

  const runCount = saveRecords(runs, (run) => {
    run.set("status", "failed");
    run.set("completed_at", failedAt);
    run.set("error_message", message);
    run.set("run_log", appendLog(run.getString("run_log"), logLine));
  });

  return {
    audits: auditCount,
    workflows: workflowCount,
    runs: runCount,
  };
}
