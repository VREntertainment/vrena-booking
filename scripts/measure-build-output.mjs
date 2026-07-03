import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const sourceTargets = [
  "components/BookingWidget.tsx",
  "components/StaffConsole.tsx",
  "components/LeaderboardPanel.tsx",
  "components/TicketBookingView.tsx",
  "components/SessionModals.tsx",
  "components/ClubView.tsx",
  "components/ProfileAuthView.tsx",
  "components/AppSidebar.tsx",
  "app/globals.css",
  "lib/bookingStaticData.ts",
  "lib/playerStatsShareImage.ts",
  "hooks/useCreateSessionCalendar.ts",
];

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
};

const readJson = (relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, "utf8"));
};

const collectFiles = (directory, predicate) => {
  const absoluteDirectory = path.join(repoRoot, directory);
  if (!existsSync(absoluteDirectory)) return [];

  const entries = [];
  const visit = (currentDirectory) => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      const relativePath = path.relative(repoRoot, absolutePath);
      if (predicate(relativePath)) {
        entries.push({ relativePath, bytes: statSync(absolutePath).size });
      }
    }
  };

  visit(absoluteDirectory);
  return entries.sort((a, b) => b.bytes - a.bytes);
};

const printTable = (title, rows, limit = 10) => {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("  No files found.");
    return;
  }

  for (const row of rows.slice(0, limit)) {
    console.log(`  ${formatBytes(row.bytes).padStart(10)}  ${row.relativePath}`);
  }
};

const sourceSizes = sourceTargets
  .map((relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!existsSync(absolutePath)) return null;
    return { relativePath, bytes: statSync(absolutePath).size };
  })
  .filter(Boolean)
  .sort((a, b) => b.bytes - a.bytes);

const chunkSizes = collectFiles(".next/static/chunks", (relativePath) =>
  /\.(?:css|js)$/.test(relativePath),
);

const pageBuildManifest = readJson(".next/server/app/page/build-manifest.json");
const pageLoadableManifest = readJson(".next/server/app/page/react-loadable-manifest.json");

console.log("VRena build measurement");
console.log("=======================");

if (!existsSync(path.join(repoRoot, ".next"))) {
  console.log("\n.next output was not found. Run `npm run build` before measuring.");
  process.exitCode = 1;
}

printTable("Largest tracked source files", sourceSizes);
printTable("Largest static JS/CSS chunks", chunkSizes);

if (pageBuildManifest?.pages?.["/page"]) {
  console.log("\nRoot page initial files");
  for (const file of pageBuildManifest.pages["/page"]) {
    console.log(`  ${file}`);
  }
}

if (pageLoadableManifest && Object.keys(pageLoadableManifest).length > 0) {
  console.log("\nRoot page dynamic payloads");
  for (const [moduleId, entry] of Object.entries(pageLoadableManifest)) {
    const files = Array.isArray(entry.files) ? entry.files : [];
    const totalBytes = files.reduce((total, file) => {
      const absolutePath = path.join(repoRoot, ".next", file);
      return total + (existsSync(absolutePath) ? statSync(absolutePath).size : 0);
    }, 0);
    console.log(`  module ${moduleId}: ${formatBytes(totalBytes)}`);
    for (const file of files) {
      console.log(`    ${file}`);
    }
  }
}

const bookingWidget = sourceSizes.find((entry) => entry.relativePath === "components/BookingWidget.tsx");
if (bookingWidget && bookingWidget.bytes > 500 * 1024) {
  console.log(
    `\nNote: BookingWidget source is ${formatBytes(
      bookingWidget.bytes,
    )}; keep extracting isolated domains before adding new features there.`,
  );
}
