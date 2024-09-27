import { exec, ExecOptions } from "child_process";
import { CronJob } from "cron";
import fs from "fs";
import { config } from "../config";
import { Logger } from "../utils/logger";

export const dumpDatebaseJob = new CronJob("0 6 * * *", () => dumpDatabase());

const credentials: ExecOptions = {
    env: {
        ...process.env,
        PGHOST: config.postgres.host,
        PGPORT: String(config.postgres.port),
        PGUSER: config.postgres.user,
        PGPASSWORD: String(config.postgres.password),
        PGDATABASE: "sponsorTimes",
    },
};

async function dumpDatabase() {
    const tables = config.dumpDatabase.tables;
    const currentTimestamp = Date.now();
    const currentDate = new Date().toISOString().slice(0, 10);
    const baseExportDir = config.dumpDatabase.appExportPath;
    const exportDir = `${baseExportDir}/${currentDate}-${currentTimestamp}`;

    // create a new export dir for this dump
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }

    // dump all listed tables
    for (const table of tables) {
        const fileName = `${exportDir}/${table.name}.csv`;
        const command = `psql -c "\\COPY \\"${table.name}\\" TO '${fileName}' WITH (FORMAT csv, HEADER true)"`;
        exec(command, credentials, (error, stdout, stderr) => {
            if (error) {
                Logger.error(`[dumpDatabase] Failed to dump ${table} due to ${stderr}`);
            } else {
                Logger.info(`[dumpDatabase] ${table} dumped to ${fileName}, ${stdout}`);
            }
        });
    }

    // wait 10s for the dump to finish
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // pack the exported files
    const zipCommand = `zip -r -9 -Z bzip2 ${baseExportDir}/latest.zip ${exportDir}/*`;
    exec(zipCommand, (error, stdout, stderr) => {
        if (error) {
            Logger.error(`[dumpDatabase] Failed to pack the export files due to ${stderr}`);
        } else {
            Logger.info(`[dumpDatabase] Export files packed to ${baseExportDir}/latest.zip, ${stdout}`);
        }
    });
}
