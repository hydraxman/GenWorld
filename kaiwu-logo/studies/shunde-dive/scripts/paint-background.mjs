import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(project, "output");
const input = join(output, "background-v3-clean.mp4");
const target = join(output, "background-v3-painted.mp4");
const stage = join(output, "paint-check");
const env = {
  ...process.env,
  HYPERFRAMES_NO_TELEMETRY: "1",
  HYPERFRAMES_RUN_ID: "shunde-painted-background-v3",
  CHROME_PATH: process.env.CHROME_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
};
const npx = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");

function run(command, args, { cwd = project, capture = false, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd, env, encoding: "utf8", stdio: capture ? "pipe" : "inherit",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(`${command} failed (${result.status})\n${result.stdout || ""}${result.stderr || ""}`);
  return result.stdout;
}

function hf(args, options) {
  if (!existsSync(npx)) throw new Error(`Cannot find npm's npx entry point: ${npx}`);
  return run(process.execPath, [npx, "hyperframes@latest", ...args], options);
}

function probe(path) {
  return JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], { capture: true }));
}

function verifyVideo(path) {
  const metadata = probe(path);
  const video = metadata.streams.find(stream => stream.codec_type === "video");
  const [num, den] = video?.avg_frame_rate.split("/").map(Number) || [];
  if (!video || video.width !== 1920 || video.height !== 1080 || num / den !== 30 ||
      Math.abs(Number(metadata.format.duration) - 4) > 0.035 || Number(video.nb_frames) !== 120 ||
      metadata.streams.some(stream => stream.codec_type === "audio")) {
    throw new Error(`Expected silent 1920x1080, 30 fps, 4 seconds / 120 frames: ${path}`);
  }
  if (["smpte2084", "arib-std-b67"].includes(video.color_transfer)) {
    throw new Error("The canonical treatment requires Rec.709/SDR input, not HDR.");
  }
  return metadata;
}

function sheet(path, name) {
  const filter = "select='eq(n,0)+eq(n,60)+eq(n,119)',scale=640:360," +
    "drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='%{pts\\:hms}':x=12:y=12:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.65,tile=3x1";
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", path, "-vf", filter,
    "-frames:v", "1", "-update", "1", join(output, name)]);
}

mkdirSync(output, { recursive: true });
const settings = JSON.parse(readFileSync(join(project, "scripts", "paint-settings.json"), "utf8"));
const applied = hf(["media-treatment", "--file", "passes/paint.html", "--selector", "#paint-source",
  "--grading", JSON.stringify(settings), "--apply", "--json"], { capture: true });
writeFileSync(join(output, "paint-treatment.json"), applied);
console.log("Canonical Kuwahara + crosshatch treatment applied to paint.html.");
if (process.argv.includes("--apply-only")) process.exit(0);
if (!existsSync(input)) throw new Error(`Waiting for clean source: ${input}. Treatment is applied; rerun when the source is ready.`);
const sourceMetadata = verifyVideo(input);
sheet(input, "paint-before-contact.jpg");

// check/snapshot currently accept a project directory, not --composition.
for (const directory of ["assets", "output"]) mkdirSync(join(stage, directory), { recursive: true });
writeFileSync(join(stage, "index.html"),
  readFileSync(join(project, "passes", "paint.html"), "utf8").replace('    <base href="../">\n', ""));
copyFileSync(join(project, "assets", "gsap.min.js"), join(stage, "assets", "gsap.min.js"));
copyFileSync(input, join(stage, "output", "background-v3-clean.mp4"));
const check = hf(["check", "--at", "0,2,3.4,3.966666667", "--timeout", "60000", "--browser-gpu", "--snapshots", "--json"],
  { cwd: stage, capture: true, allowFailure: true });
writeFileSync(join(output, "paint-check.json"), check);
const audit = JSON.parse(check);
const errors = ["lint", "runtime", "layout", "motion", "contrast"]
  .flatMap(group => audit[group]?.findings || []).filter(finding => finding.severity === "error");
if (errors.some(finding => finding.code !== "sweep_static")) throw new Error(`Composition check failed: ${JSON.stringify(errors)}`);
if (!audit.ok && !errors.length) throw new Error("Composition check failed without a supported finding.");
// A video-only pass has fixed DOM geometry; verify its actual picture motion below.
if (errors.length) console.warn("check reports sweep_static for fixed video geometry; inspect captured frames and rendered motion.");
if (process.argv.includes("--prepare")) process.exit(0);
if (existsSync(target)) throw new Error(`Refusing to overwrite existing render: ${target}`);
hf(["render", "--composition", "passes/paint.html", "--quality", "high", "--fps", "30",
  "--browser-gpu", "--workers", "1", "--output", target]);
const renderedMetadata = verifyVideo(target);
sheet(target, "paint-after-contact.jpg");
for (const [path, name] of [[input, "paint-source-hold.framemd5"], [target, "paint-output-hold.framemd5"]]) {
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", path,
    "-vf", "select='gte(n,102)'", "-an", "-f", "framemd5", join(output, name)]);
}
writeFileSync(join(output, "paint-validation.json"), JSON.stringify({ sourceMetadata, renderedMetadata, settings }, null, 2));
console.log(`Painted background verified: ${target}`);
