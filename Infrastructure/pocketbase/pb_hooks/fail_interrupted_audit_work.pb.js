onBootstrap((e) => {
  e.next();

  const errorMessage = (error) =>
    error && error.message ? error.message : String(error);
  const failedAt = new Date().toISOString();
  const message = "Interrupted by service restart.";
  const logLine = `[${failedAt}] ${message}`;
  const appendLog = (existing, line) => {
    const value = String(existing || "").trim();
    return value ? `${value}\n${line}` : line;
  };
  const interruptedRecords = (collectionName) => {
    try {
      return e.app.findRecordsByFilter(
        collectionName,
        'status = "queued" || status = "running"',
        "",
        0,
        0,
      );
    } catch {
      return [];
    }
  };
  const saveRecords = (records, apply) => {
    let count = 0;

    records.forEach((record) => {
      try {
        apply(record);
        e.app.save(record);
        count += 1;
      } catch (error) {
        console.warn(
          `[startup] PocketBase skipped interrupted record ${record.id}: ${errorMessage(error)}`,
        );
      }
    });

    return count;
  };

  try {
    const allAudits = interruptedRecords("audits");
    const allWorkflows = interruptedRecords("workflows");
    const allRuns = interruptedRecords("runs");
    const waitingWorkflowIds = new Set();
    const waitingAuditIds = new Set();

    allWorkflows.forEach((workflow) => {
      const isQueued = workflow.getString("status") === "queued";
      const dataForSEOTaskId = String(
        workflow.getString("dataforseo_task_id") || "",
      ).trim();
      if (!isQueued || !dataForSEOTaskId) return;
      waitingWorkflowIds.add(workflow.id);
      waitingAuditIds.add(workflow.getString("audit"));
    });

    const audits = allAudits.filter((audit) => !waitingAuditIds.has(audit.id));
    const workflows = allWorkflows.filter(
      (workflow) => !waitingWorkflowIds.has(workflow.id),
    );
    const runs = allRuns.filter(
      (run) => !waitingWorkflowIds.has(run.getString("workflow")),
    );

    const auditCount = saveRecords(audits, (audit) => {
      audit.set("status", "failed");
      audit.set("updated_at", failedAt);
    });
    const workflowCount = saveRecords(workflows, (workflow) => {
      workflow.set("status", "failed");
      workflow.set("completed_at", failedAt);
      workflow.set("error_message", message);
      workflow.set(
        "run_log",
        appendLog(workflow.getString("run_log"), logLine),
      );
    });
    const runCount = saveRecords(runs, (run) => {
      run.set("status", "failed");
      run.set("completed_at", failedAt);
      run.set("error_message", message);
      run.set("run_log", appendLog(run.getString("run_log"), logLine));
    });

    console.log(
      `[startup] PocketBase failed interrupted audit work: ${auditCount} audit(s), ${workflowCount} workflow(s), ${runCount} run(s).`,
    );
  } catch (error) {
    console.warn(
      `[startup] PocketBase failed to reconcile interrupted audit work: ${errorMessage(error)}`,
    );
  }
});
