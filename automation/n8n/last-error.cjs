// Prints the node-by-node result of the latest n8n executions (reads n8n's local DB, read-only).
//   node automation/n8n/last-error.cjs [count=1]
const { execSync } = require("child_process");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { parse } = require(path.join(process.env.APPDATA, "npm/node_modules/n8n/node_modules/flatted"));

const count = Number(process.argv[2] || 1);
const tmp = path.join(os.tmpdir(), "ff_execs.json");
execSync(`python -c "import sqlite3,os,json;c=sqlite3.connect('file:'+os.path.expanduser(r'~\\.n8n\\database.sqlite')+'?mode=ro',uri=True);rows=c.execute('select e.id,e.status,w.name,d.data from execution_entity e join execution_data d on d.executionId=e.id join workflow_entity w on w.id=e.workflowId order by e.id desc limit ${count}').fetchall();open(r'${tmp}','w',encoding='utf-8').write(json.dumps(rows))"`);
for (const [id, status, name, data] of JSON.parse(fs.readFileSync(tmp, "utf8"))) {
  const rd = parse(data).resultData;
  console.log(`\n=== #${id} ${status} · ${name} · last node: ${rd.lastNodeExecuted}`);
  if (rd.error) console.log("ERROR:", rd.error.message, "|", rd.error.description || "", "| node:", rd.error.node && rd.error.node.name);
  for (const [n, runs] of Object.entries(rd.runData || {})) {
    const r = runs[runs.length - 1];
    console.log(" -", n, r.error ? "ERR: " + r.error.message + " | " + (r.error.description || "") : "ok", JSON.stringify(r.data?.main?.[0]?.[0]?.json || r.data?.ai_tool?.[0]?.[0]?.json || {}).slice(0, 220));
  }
}
